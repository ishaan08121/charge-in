import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiLogin, apiSignup } from '../api/auth';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: true,

  // Call on app start to restore session
  hydrate: async () => {
    const token = await AsyncStorage.getItem('access_token');
    const userStr = await AsyncStorage.getItem('user');
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr), isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await apiLogin(email, password);
    const { session, user } = data;
    await AsyncStorage.multiSet([
      ['access_token', session.access_token],
      ['refresh_token', session.refresh_token],
      ['user', JSON.stringify(user)],
    ]);
    set({ user, token: session.access_token });
  },

  signup: async (email, password, full_name, phone) => {
    const { data } = await apiSignup(email, password, full_name, phone);
    return data;
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    set({ user: null, token: null });
  },
}));
