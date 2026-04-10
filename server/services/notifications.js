import { Expo } from 'expo-server-sdk';

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

async function sendPush(pushToken, title, body, data = {}) {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

  const message = { to: pushToken, sound: 'default', title, body, data };
  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    console.error('Push notification error:', err.message);
  }
}

/**
 * Notify host that a new booking request arrived.
 */
export async function notifyHost(hostPushToken, booking) {
  await sendPush(
    hostPushToken,
    'New Booking Request',
    `Someone wants to charge at your station on ${new Date(booking.start_time).toLocaleString('en-IN')}`,
    { type: 'BOOKING_REQUEST', bookingId: booking.id }
  );
}

/**
 * Notify user about their booking status (confirmed / declined).
 */
export async function notifyUser(userPushToken, status, booking) {
  const isConfirmed = status === 'confirmed';
  await sendPush(
    userPushToken,
    isConfirmed ? 'Booking Confirmed!' : 'Booking Declined',
    isConfirmed
      ? `Your booking on ${new Date(booking.start_time).toLocaleString('en-IN')} has been confirmed.`
      : `Your booking on ${new Date(booking.start_time).toLocaleString('en-IN')} was declined. You will receive a full refund.`,
    { type: isConfirmed ? 'BOOKING_CONFIRMED' : 'BOOKING_DECLINED', bookingId: booking.id }
  );
}

/**
 * Notify host that user cancelled a booking.
 */
export async function notifyHostCancelled(hostPushToken, booking) {
  await sendPush(
    hostPushToken,
    'Booking Cancelled',
    `A booking for ${new Date(booking.start_time).toLocaleString('en-IN')} was cancelled by the user.`,
    { type: 'BOOKING_CANCELLED', bookingId: booking.id }
  );
}

/**
 * Notify host that a charging session has ended.
 */
export async function notifyHostSessionEnded(hostPushToken, booking, unitsKwh, amount) {
  await sendPush(
    hostPushToken,
    'Session Ended',
    `Charging session complete. ${unitsKwh} kWh delivered. Earnings: ₹${(amount / 100).toFixed(2)} queued for payout.`,
    { type: 'SESSION_ENDED', bookingId: booking.id }
  );
}
