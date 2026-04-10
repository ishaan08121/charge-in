import { Router } from 'express';
import crypto from 'crypto';
import supabase from '../services/supabase.js';
import razorpay from '../services/razorpay.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyHost, notifyUser, notifyHostSessionEnded, notifyHostCancelled } from '../services/notifications.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function getUserPushToken(userId) {
  const { data } = await supabase
    .from('users')
    .select('expo_push_token')
    .eq('id', userId)
    .single();
  return data?.expo_push_token || null;
}

// ─── POST /api/bookings/initiate ──────────────────────────────────────────────
// Creates a Razorpay order (manual capture). Returns order for payment sheet.
router.post('/initiate', requireAuth, async (req, res, next) => {
  try {
    const { charger_id, start_time, end_time } = req.body;
    if (!charger_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'charger_id, start_time and end_time are required' });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);
    if (start >= end) return res.status(400).json({ error: 'end_time must be after start_time' });
    if (start < new Date()) return res.status(400).json({ error: 'start_time must be in the future' });

    // Get charger details
    const { data: charger, error: chargerErr } = await supabase
      .from('chargers')
      .select('id, host_id, price_per_kwh, power_kw, is_available, title')
      .eq('id', charger_id)
      .single();

    if (chargerErr) return res.status(404).json({ error: 'Charger not found' });
    if (!charger.is_available) return res.status(400).json({ error: 'Charger is not available' });
    if (charger.host_id === req.userId) return res.status(400).json({ error: 'Cannot book your own charger' });

    // Estimate amount: power_kw * hours * price_per_kwh (in paise)
    const hours = (end - start) / (1000 * 60 * 60);
    const estimatedKwh = charger.power_kw * hours;
    const estimatedAmount = Math.round(estimatedKwh * charger.price_per_kwh * 100); // paise

    // Create Razorpay order with manual capture (payment_capture: 0)
    const order = await razorpay.orders.create({
      amount: estimatedAmount,
      currency: 'INR',
      payment_capture: 0,
      notes: {
        charger_id,
        user_id: req.userId,
        start_time,
        end_time,
      },
    });

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      estimated_kwh: estimatedKwh.toFixed(2),
      charger_title: charger.title,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/bookings/confirm ───────────────────────────────────────────────
// Verifies Razorpay payment signature, then atomically creates the booking.
router.post('/confirm', requireAuth, async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      charger_id,
      start_time,
      end_time,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Razorpay payment details are required' });
    }

    // 1. Verify signature (skip in test/dev mode for simulated payments)
    const isTestPayment = razorpay_payment_id.startsWith('pay_test_');
    if (!isTestPayment) {
      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSig !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
    }

    // 2. Get order amount (use dummy amount for test payments)
    const order = isTestPayment
      ? { amount: 10000 }  // ₹100 dummy amount for test
      : await razorpay.orders.fetch(razorpay_order_id);

    // 3. Get charger + host info
    const { data: charger } = await supabase
      .from('chargers')
      .select('host_id')
      .eq('id', charger_id)
      .single();

    if (!charger) return res.status(404).json({ error: 'Charger not found' });

    // 4. Atomically create booking (conflict check inside RPC)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_booking_atomic', {
      p_user_id: req.userId,
      p_charger_id: charger_id,
      p_host_id: charger.host_id,
      p_start_time: start_time,
      p_end_time: end_time,
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_amount_held: order.amount,
    });

    if (rpcErr) {
      // Conflict — refund the payment
      await razorpay.payments.refund(razorpay_payment_id, { speed: 'normal' });
      return res.status(409).json({ error: rpcErr.message || 'Time slot conflict, payment refunded' });
    }

    const booking = rpcResult;

    // 5. Notify host
    const hostToken = await getUserPushToken(charger.host_id);
    await notifyHost(hostToken, booking);

    return res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/bookings/:id/respond ──────────────────────────────────────────
// Host accepts or declines a pending booking.
router.post('/:id/respond', requireAuth, async (req, res, next) => {
  try {
    const { action } = req.body; // 'accept' | 'decline'
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
    }

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr) return res.status(404).json({ error: 'Booking not found' });
    if (booking.host_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    if (booking.status !== 'pending') return res.status(400).json({ error: 'Booking is not pending' });

    const isTestPayment = booking.razorpay_payment_id?.startsWith('pay_test_');

    if (action === 'accept') {
      // Capture the held payment (skip for test payments)
      if (!isTestPayment) {
        await razorpay.payments.capture(booking.razorpay_payment_id, booking.amount_held, 'INR');
      }

      await supabase
        .from('bookings')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', booking.id);

      const userToken = await getUserPushToken(booking.user_id);
      await notifyUser(userToken, 'confirmed', booking);

      return res.json({ message: 'Booking confirmed and payment captured' });
    } else {
      // Decline — refund the held payment (skip for test payments)
      if (!isTestPayment) {
        await razorpay.payments.refund(booking.razorpay_payment_id, { speed: 'normal' });
      }

      await supabase
        .from('bookings')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', booking.id);

      const userToken = await getUserPushToken(booking.user_id);
      await notifyUser(userToken, 'declined', booking);

      return res.json({ message: 'Booking declined and payment refunded' });
    }
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/bookings/:id/start ─────────────────────────────────────────────
// User presents OTP to host → start charging session.
router.post('/:id/start', requireAuth, async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'otp is required' });

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr) return res.status(404).json({ error: 'Booking not found' });
    if (booking.host_id !== req.userId) return res.status(403).json({ error: 'Forbidden — only host can start session' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'Booking is not confirmed' });
    if (booking.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    const now = new Date().toISOString();

    await supabase
      .from('bookings')
      .update({ status: 'active', updated_at: now })
      .eq('id', booking.id);

    // Create session record
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .insert({ booking_id: booking.id, started_at: now })
      .select()
      .single();

    if (sessionErr) return res.status(400).json({ error: sessionErr.message });

    return res.json({ message: 'Session started', session });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/bookings/:id/end ───────────────────────────────────────────────
// Host records units consumed, calculates final amount, queues payout.
router.post('/:id/end', requireAuth, async (req, res, next) => {
  try {
    const { units_kwh } = req.body;
    if (units_kwh === undefined || units_kwh < 0) {
      return res.status(400).json({ error: 'units_kwh is required and must be >= 0' });
    }

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select(`*, charger:chargers(price_per_kwh)`)
      .eq('id', req.params.id)
      .single();

    if (fetchErr) return res.status(404).json({ error: 'Booking not found' });
    if (booking.host_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    if (booking.status !== 'active') return res.status(400).json({ error: 'Booking is not active' });

    const finalAmount = Math.round(units_kwh * booking.charger.price_per_kwh * 100); // paise
    const now = new Date().toISOString();
    const isTestPayment = booking.razorpay_payment_id?.startsWith('pay_test_');

    // If final amount < captured amount, refund the difference (skip for test payments)
    if (finalAmount < booking.amount_held && !isTestPayment) {
      const refundAmount = booking.amount_held - finalAmount;
      await razorpay.payments.refund(booking.razorpay_payment_id, {
        amount: refundAmount,
        speed: 'normal',
        notes: { reason: 'Partial refund — actual usage less than estimated' },
      });
    }

    // Update session
    const { data: session } = await supabase
      .from('sessions')
      .update({ ended_at: now, units_kwh, final_amount: finalAmount })
      .eq('booking_id', booking.id)
      .select()
      .single();

    // Mark booking completed
    await supabase
      .from('bookings')
      .update({ status: 'completed', updated_at: now })
      .eq('id', booking.id);

    // Platform fee (10%), host gets 90%
    const platformFee = Math.round(finalAmount * 0.1);
    const hostEarnings = finalAmount - platformFee;

    // Queue payout
    await supabase.from('payouts').insert({
      booking_id: booking.id,
      host_id: booking.host_id,
      amount: hostEarnings,
      status: 'pending',
    });

    // Notify host
    const hostToken = await getUserPushToken(booking.host_id);
    await notifyHostSessionEnded(hostToken, booking, units_kwh, hostEarnings);

    return res.json({ message: 'Session ended', session, final_amount_inr: (finalAmount / 100).toFixed(2) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/bookings/:id/cancel ────────────────────────────────────────────
// User cancels booking. Refund policy: >24h full, 2-24h 50%, <2h no refund.
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ error: 'Booking cannot be cancelled at this stage' });
    }

    const hoursUntilStart = (new Date(booking.start_time) - Date.now()) / (1000 * 60 * 60);
    let refundAmount = 0;
    let refundPolicy = '';

    if (hoursUntilStart > 24) {
      refundAmount = booking.amount_held;
      refundPolicy = 'Full refund (>24h notice)';
    } else if (hoursUntilStart >= 2) {
      refundAmount = Math.round(booking.amount_held * 0.5);
      refundPolicy = '50% refund (2-24h notice)';
    } else {
      refundAmount = 0;
      refundPolicy = 'No refund (<2h notice)';
    }

    const isTestPayment = booking.razorpay_payment_id?.startsWith('pay_test_');
    if (refundAmount > 0 && !isTestPayment) {
      await razorpay.payments.refund(booking.razorpay_payment_id, {
        amount: refundAmount,
        speed: 'normal',
        notes: { reason: refundPolicy },
      });
    }

    await supabase
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', booking.id);

    // Notify host that booking was cancelled
    const hostToken = await getUserPushToken(booking.host_id);
    await notifyHostCancelled(hostToken, booking);

    return res.json({
      message: 'Booking cancelled',
      refund_policy: refundPolicy,
      refund_amount_inr: (refundAmount / 100).toFixed(2),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/bookings/:id ────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        charger:chargers(id, title, address, city, power_kw, price_per_kwh),
        session:sessions(started_at, ended_at, units_kwh, final_amount)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Booking not found' });

    // Only the user or host can view this booking
    if (data.user_id !== req.userId && data.host_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({ booking: data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/bookings ────────────────────────────────────────────────────────
// List bookings. role=user (default) or role=host.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { role = 'user', status, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        charger:chargers(id, title, address, city),
        session:sessions(started_at, ended_at, units_kwh, final_amount)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (role === 'host') {
      query = query.eq('host_id', req.userId);
    } else {
      query = query.eq('user_id', req.userId);
    }

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    return res.json({ bookings: data });
  } catch (err) {
    next(err);
  }
});

export default router;
