import { useThemeStore } from '../store/themeStore';

export const darkColors = {
  bg: '#0d0d0d',
  card: '#1a1a1a',
  cardBorder: '#2a2a2a',
  surface: '#222222',
  primary: '#00c853',
  primaryDim: '#1a3a2a',
  blue: '#2196F3',
  danger: '#ef5350',
  textPrimary: '#ffffff',
  textSecondary: '#999999',
  textMuted: '#555555',
  star: '#FFA726',
  tabActive: '#00c853',
  tabInactive: '#555555',
  filterBg: '#1e1e1e',
  filterActive: '#00c853',
  filterActiveBg: '#1a3a2a',
  modalOverlay: 'rgba(0,0,0,0.6)',
  sheetBg: '#151515',
};

export const lightColors = {
  bg: '#f5f5f5',
  card: '#ffffff',
  cardBorder: '#e8e8e8',
  surface: '#f0f0f0',
  primary: '#00a844',
  primaryDim: '#e8f5ee',
  blue: '#2196F3',
  danger: '#ef5350',
  textPrimary: '#111111',
  textSecondary: '#555555',
  textMuted: '#aaaaaa',
  star: '#FFA726',
  tabActive: '#00a844',
  tabInactive: '#aaaaaa',
  filterBg: '#ececec',
  filterActive: '#00a844',
  filterActiveBg: '#e8f5ee',
  modalOverlay: 'rgba(0,0,0,0.4)',
  sheetBg: '#ffffff',
};

// Static fallback (dark) — for files not yet using the hook
export const colors = darkColors;

export function useColors() {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : lightColors;
}
