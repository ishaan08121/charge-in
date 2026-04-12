import client from './client';

export const apiInitiateBooking = (charger_id, start_time, end_time) =>
  client.post('/bookings/initiate', { charger_id, start_time, end_time });

export const apiConfirmBooking = (payload) =>
  client.post('/bookings/confirm', payload);

export const apiGetBookings = (role = 'user', status) =>
  client.get('/bookings', { params: { role, status } });

export const apiGetBooking = (id) =>
  client.get(`/bookings/${id}`);

export const apiCancelBooking = (id) =>
  client.post(`/bookings/${id}/cancel`);

export const apiRespondBooking = (id, action) =>
  client.post(`/bookings/${id}/respond`, { action });

export const apiStartSession = (id, otp) =>
  client.post(`/bookings/${id}/start`, { otp });

export const apiEndSession = (id, units_kwh) =>
  client.post(`/bookings/${id}/end`, { units_kwh });
