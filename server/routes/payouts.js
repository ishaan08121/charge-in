import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();

const RAZORPAYX_BASE = 'https://api.razorpay.com/v1';

function rzpAuthHeader() {
  const creds = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${creds}`;
}

async function rzpPost(path, body) {
  const res = await fetch(`${RAZORPAYX_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: rzpAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error?.description || 'Razorpay request failed'), { status: res.status, data });
  return data;
}

// GET /api/payouts/earnings — total earnings summary for host
router.get('/earnings', requireAuth, async (req, res, next) => {
  try {
    const { data: payouts, error } = await supabase
      .from('payouts')
      .select('amount, status')
      .eq('host_id', req.userId);

    if (error) return res.status(400).json({ error: error.message });

    const total = payouts.reduce((sum, p) => sum + p.amount, 0);
    const paid = payouts.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const pending = payouts.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      total_earnings_paise: total,
      paid_paise: paid,
      pending_paise: pending,
      total_earnings_inr: (total / 100).toFixed(2),
      paid_inr: (paid / 100).toFixed(2),
      pending_inr: (pending / 100).toFixed(2),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/payouts — list all payouts for the host
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('payouts')
      .select('*, booking:bookings(id, start_time, end_time)')
      .eq('host_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ payouts: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/payouts/withdraw — trigger a UPI payout via Razorpay X
router.post('/withdraw', requireAuth, async (req, res, next) => {
  // TODO: Enable after Razorpay X KYC + account activation is complete
  return res.status(503).json({ error: 'Payouts coming soon. KYC verification pending.' });

  try {
    const { amount_paise } = req.body; // amount in paise

    // Get host UPI ID
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('upi_id, full_name')
      .eq('id', req.userId)
      .single();

    if (userErr || !user) return res.status(404).json({ error: 'User not found' });
    if (!user.upi_id) return res.status(400).json({ error: 'UPI ID not set in profile' });

    // Check available pending balance
    const { data: pendingPayouts } = await supabase
      .from('payouts')
      .select('id, amount')
      .eq('host_id', req.userId)
      .eq('status', 'pending');

    const availableBalance = (pendingPayouts || []).reduce((sum, p) => sum + p.amount, 0);
    const withdrawAmount = amount_paise || availableBalance;

    if (withdrawAmount <= 0) return res.status(400).json({ error: 'No pending earnings to withdraw' });
    if (withdrawAmount > availableBalance) {
      return res.status(400).json({ error: 'Withdrawal amount exceeds available balance' });
    }

    // 1. Create a fund account for the host's UPI ID
    const fundAccount = await rzpPost('/fund_accounts', {
      contact_id: req.userId, // Razorpay contact ID — pre-create contacts via dashboard/API
      account_type: 'vpa',
      vpa: { address: user.upi_id },
    });
    const fundAccountId = fundAccount.id;

    // 2. Initiate payout
    const payoutData = await rzpPost('/payouts', {
      account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
      fund_account_id: fundAccountId,
      amount: withdrawAmount,
      currency: 'INR',
      mode: 'UPI',
      purpose: 'payout',
      queue_if_low_balance: true,
      narration: 'Charge.in earnings',
      notes: { host_id: req.userId },
    });

    const rzpPayoutId = payoutData.id;

    // 3. Update payout records in DB
    const payoutIds = (pendingPayouts || [])
      .filter((p) => p.amount <= withdrawAmount)
      .map((p) => p.id);

    await supabase
      .from('payouts')
      .update({ status: 'processing', razorpay_payout_id: rzpPayoutId, updated_at: new Date().toISOString() })
      .in('id', payoutIds);

    return res.json({ message: 'Payout initiated', razorpay_payout_id: rzpPayoutId, amount_paise: withdrawAmount });
  } catch (err) {
    if (err.data) {
      return res.status(err.status || 400).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
