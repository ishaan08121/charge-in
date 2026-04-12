import client from './client';

export const apiLogin = (email, password) =>
  client.post('/auth/login', { email, password });

export const apiSignup = (email, password, full_name, phone) =>
  client.post('/auth/signup', { email, password, full_name, phone });

export const apiSendOtp = (phone) =>
  client.post('/auth/phone', { phone });

export const apiVerifyOtp = (phone, token) =>
  client.post('/auth/phone/verify', { phone, token });

export const apiUpdateProfile = (data) =>
  client.put('/auth/profile', data);
