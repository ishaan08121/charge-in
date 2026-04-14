import client from './client';

export const apiGetMe = () => client.get('/users/me');

export const apiGetUser = (id) => client.get(`/users/${id}`);

export const apiUpdateMe = (data) => client.put('/users/me', data);

export const apiSavePushToken = (expo_push_token) =>
  client.post('/users/push-token', { expo_push_token });

export const apiUploadAvatar = (uri, mimeType = 'image/jpeg') => {
  const form = new FormData();
  form.append('avatar', { uri, name: 'avatar.jpg', type: mimeType });
  return client.post('/users/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
