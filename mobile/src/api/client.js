import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

// Track if a refresh is already in progress to avoid multiple parallel refresh calls
let isRefreshing = false;
let refreshQueue = []; // callbacks waiting for the new token

function onRefreshDone(newToken) {
  refreshQueue.forEach((cb) => cb(newToken));
  refreshQueue = [];
}

// Attach JWT on every request
client.interceptors.request.use(async (config) => {
  const { useAuthStore } = await import('../store/authStore');
  const token = useAuthStore.getState().token || await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: try refresh → retry original request → if refresh fails, logout
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh if the refresh call itself failed
    if (originalRequest.url?.includes('/auth/refresh')) {
      const { useAuthStore } = await import('../store/authStore');
      useAuthStore.setState({ user: null, token: null });
      AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      // Another request already refreshing — queue this one
      return new Promise((resolve, reject) => {
        refreshQueue.push((newToken) => {
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(client(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');

      // Call refresh endpoint (without auth header — it's a public endpoint)
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      }, { timeout: 10000 }); // 10s timeout — prevent infinite hang

      const newAccessToken = data.session.access_token;
      const newRefreshToken = data.session.refresh_token;

      // Save new tokens
      await AsyncStorage.multiSet([
        ['access_token', newAccessToken],
        ['refresh_token', newRefreshToken],
      ]);

      const { useAuthStore } = await import('../store/authStore');
      useAuthStore.setState({ token: newAccessToken });

      // Retry all queued requests with new token
      onRefreshDone(newAccessToken);

      // Retry original request
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return client(originalRequest);
    } catch (refreshErr) {
      // Refresh failed — session truly expired, force logout
      onRefreshDone(null);
      const { useAuthStore } = await import('../store/authStore');
      useAuthStore.setState({ user: null, token: null });
      AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default client;
