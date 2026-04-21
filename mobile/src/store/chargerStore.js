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
  availableOnly: false,

  setFilter: (key, value) => set({ [key]: value }),

  getFiltered: () => {
    const { chargers, availableOnly, minRating } = get();
    return chargers.filter(c => {
      if (availableOnly && !c.is_available) return false;
      if (minRating && parseFloat(c.average_rating) < minRating) return false;
      return true;
    });
  },

  removeCharger: (id) => set(state => ({
    chargers: state.chargers.filter(c => c.id !== id),
  })),

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
