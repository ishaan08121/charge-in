import { create } from 'zustand';
import { apiGetBookings, apiGetBooking } from '../api/bookings';

export const useBookingStore = create((set) => ({
  bookings: [],
  activeBooking: null,
  loading: false,
  error: null,

  fetchBookings: async (role = 'user') => {
    set({ loading: true, error: null });
    try {
      const { data } = await apiGetBookings(role);
      set({ bookings: data.bookings, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load bookings', loading: false });
    }
  },

  fetchBooking: async (id) => {
    const { data } = await apiGetBooking(id);
    set({ activeBooking: data.booking });
    return data.booking;
  },

  setActiveBooking: (booking) => set({ activeBooking: booking }),
}));
