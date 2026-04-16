import AsyncStorage from '@react-native-async-storage/async-storage';
import client from './client';
import { API_BASE_URL } from '../constants/config';

export const apiGetMe = () => client.get('/users/me');
export const apiGetUserRating = (userId) => client.get(`/reviews/user/${userId}`);

export const apiGetUser = (id) => client.get(`/users/${id}`);

export const apiUpdateMe = (data) => client.put('/users/me', data);

export const apiSavePushToken = (expo_push_token) =>
  client.post('/users/push-token', { expo_push_token });

// Use fetch instead of axios — axios mangles multipart boundaries on React Native
export const apiUploadAvatar = async (uri, mimeType = 'image/jpeg') => {
  const token = await AsyncStorage.getItem('access_token');
  const form = new FormData();
  form.append('avatar', { uri, name: 'avatar.jpg', type: mimeType });
  const resp = await fetch(`${API_BASE_URL}/users/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await resp.json();
  if (!resp.ok) throw { response: { data: json } };
  return { data: json };
};
