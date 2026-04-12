import { create } from 'zustand';
import { apiGetNearby } from '../api/chargers';

export const useChargerStore = create((set, get) => ({
  chargers: [],
  loading: false,
  error: null,

  // Filters
  connectorFilter: null,   // null | 'AC' | 'DC'
  radiusKm: 10,
  minRating: null,         // null | 4 | 4.5

  setFilter: (key, value) => set({ [key]: value }),

  fetchNearby: async (lat, lng) => {
    set({ loading: true, error: null });
    try {
      const { connectorFilter, radiusKm } = get();
      const { data } = await apiGetNearby(lat, lng, radiusKm, connectorFilter);
      set({ chargers: data.chargers, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load chargers', loading: false });
    }
  },
}));
