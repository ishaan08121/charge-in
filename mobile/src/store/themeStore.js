import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useThemeStore = create((set) => ({
  isDark: true,

  hydrate: async () => {
    const val = await AsyncStorage.getItem('theme');
    if (val !== null) set({ isDark: val === 'dark' });
  },

  toggleTheme: async () => {
    set((s) => {
      const next = !s.isDark;
      AsyncStorage.setItem('theme', next ? 'dark' : 'light');
      return { isDark: next };
    });
  },
}));
