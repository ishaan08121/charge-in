import cron from 'node-cron';
import supabase from '../services/supabase.js';
import razorpay from '../services/razorpay.js';

// Auto-expire pending bookings that host never responded to (30 min)
async function expirePendingBookings() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, razorpay_payment_id')
    .eq('status', 'pending')
    .lt('created_at', cutoff);

  if (error) { console.error('[BookingExpiry] Fetch error:', error.message); return; }
  if (!bookings?.length) return;

  for (const booking of bookings) {
    try {
      const isTestPayment = booking.razorpay_payment_id?.startsWith('pay_test_');
      if (booking.razorpay_payment_id && !isTestPayment) {
        await razorpay.payments.refund(booking.razorpay_payment_id, {
          speed: 'normal',
          notes: { reason: 'Booking auto-expired — host did not respond in 30 minutes' },
        });
      }
      await supabase
        .from('bookings')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', booking.id);

      console.log(`[BookingExpiry] Expired pending booking ${booking.id}`);
    } catch (err) {
      console.error(`[BookingExpiry] Error expiring pending ${booking.id}:`, err.message);
    }
  }
}

// Auto-cancel confirmed bookings where client never showed up (30 min past start_time)
async function cancelNoShowBookings() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, razorpay_payment_id, amount_held')
    .eq('status', 'confirmed')
    .lt('start_time', cutoff);

  if (error) { console.error('[BookingExpiry] No-show fetch error:', error.message); return; }
  if (!bookings?.length) return;

  for (const booking of bookings) {
    try {
      // No refund for no-shows (client's fault)
      // But for test payments we skip razorpay entirely
      await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancel_reason: 'Client did not show up',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      console.log(`[BookingExpiry] No-show cancelled booking ${booking.id}`);
    } catch (err) {
      console.error(`[BookingExpiry] Error cancelling no-show ${booking.id}:`, err.message);
    }
  }
}

export function startBookingCron() {
  cron.schedule('*/5 * * * *', async () => {
    console.log('[BookingExpiry] Running expiry check...');
    await expirePendingBookings().catch(console.error);
    await cancelNoShowBookings().catch(console.error);
  });
  console.log('[BookingExpiry] Cron started — checking every 5 minutes');
}
