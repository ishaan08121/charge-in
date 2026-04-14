import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/reviews — submit a review after a completed booking
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { booking_id, rating, comment } = req.body;
    if (!booking_id || !rating) {
      return res.status(400).json({ error: 'booking_id and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    // Verify the booking belongs to this user and is completed
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, charger_id, user_id, status')
      .eq('id', booking_id)
      .single();

    if (bookingErr) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'Can only review completed bookings' });
    }

    // Prevent duplicate reviews
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', booking_id)
      .single();

    if (existing) return res.status(409).json({ error: 'You have already reviewed this booking' });

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        booking_id,
        charger_id: booking.charger_id,
        reviewer_id: req.userId,
        rating,
        comment: comment || null,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ review: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews/client — host rates a client after completed session
router.post('/client', requireAuth, async (req, res, next) => {
  try {
    const { booking_id, rating } = req.body;
    if (!booking_id || !rating) return res.status(400).json({ error: 'booking_id and rating are required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1–5' });

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, host_id, user_id, status')
      .eq('id', booking_id)
      .single();

    if (bookingErr) return res.status(404).json({ error: 'Booking not found' });
    if (booking.host_id !== req.userId) return res.status(403).json({ error: 'Only the host can rate a client' });
    if (booking.status !== 'completed') return res.status(400).json({ error: 'Can only rate after session is completed' });

    const { data: existing } = await supabase
      .from('client_ratings')
      .select('id')
      .eq('booking_id', booking_id)
      .single();

    if (existing) return res.status(409).json({ error: 'Already rated this client for this booking' });

    const { data, error } = await supabase
      .from('client_ratings')
      .insert({ booking_id, host_id: req.userId, client_id: booking.user_id, rating })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ rating: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/user/:userId — get average client rating for a user
router.get('/user/:userId', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('client_ratings')
      .select('rating')
      .eq('client_id', req.params.userId);

    if (error) return res.status(400).json({ error: error.message });

    const avg = data.length
      ? (data.reduce((sum, r) => sum + r.rating, 0) / data.length).toFixed(1)
      : null;

    return res.json({ average_rating: avg, total: data.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews/client — host rates a client after completed session
router.post('/client', requireAuth, async (req, res, next) => {
  try {
    const { booking_id, rating } = req.body;
    if (!booking_id || !rating) return res.status(400).json({ error: 'booking_id and rating are required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1–5' });

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, host_id, user_id, status')
      .eq('id', booking_id)
      .single();

    if (bookingErr) return res.status(404).json({ error: 'Booking not found' });
    if (booking.host_id !== req.userId) return res.status(403).json({ error: 'Only the host can rate a client' });
    if (booking.status !== 'completed') return res.status(400).json({ error: 'Can only rate after session is completed' });

    const { data: existing } = await supabase
      .from('client_ratings')
      .select('id')
      .eq('booking_id', booking_id)
      .single();

    if (existing) return res.status(409).json({ error: 'Already rated this client for this booking' });

    const { data, error } = await supabase
      .from('client_ratings')
      .insert({ booking_id, host_id: req.userId, client_id: booking.user_id, rating })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ rating: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/user/:userId — get average client rating for a user
router.get('/user/:userId', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('client_ratings')
      .select('rating')
      .eq('client_id', req.params.userId);

    if (error) return res.status(400).json({ error: error.message });

    const avg = data.length
      ? (data.reduce((sum, r) => sum + r.rating, 0) / data.length).toFixed(1)
      : null;

    return res.json({ average_rating: avg, total: data.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/charger/:chargerId — fetch reviews for a charger
router.get('/charger/:chargerId', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id, rating, comment, created_at,
        reviewer:users!reviews_reviewer_id_fkey(id, full_name)
      `)
      .eq('charger_id', req.params.chargerId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    const avg = data.length
      ? (data.reduce((sum, r) => sum + r.rating, 0) / data.length).toFixed(1)
      : null;

    return res.json({ reviews: data, average_rating: avg, total: data.length });
  } catch (err) {
    next(err);
  }
});

export default router;
