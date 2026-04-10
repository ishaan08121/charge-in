import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'email, password and full_name are required' });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: phone || null },
    });

    if (error) return res.status(400).json({ error: error.message });

    // Create profile row in public.users
    await supabase.from('users').insert({
      id: data.user.id,
      email,
      full_name,
      phone: phone || null,
    });

    return res.status(201).json({ user: data.user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    return res.json({ user: data.user, session: data.session });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/phone — send OTP to phone number
router.post('/phone', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) return res.status(400).json({ error: error.message });

    return res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/phone/verify — verify OTP and return session
router.post('/phone/verify', async (req, res, next) => {
  try {
    const { phone, token } = req.body;
    if (!phone || !token) {
      return res.status(400).json({ error: 'phone and token are required' });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) return res.status(400).json({ error: error.message });

    // Upsert profile row in case user signed up via phone only
    await supabase.from('users').upsert({
      id: data.user.id,
      phone,
      email: data.user.email || null,
      full_name: data.user.user_metadata?.full_name || null,
    }, { onConflict: 'id' });

    return res.json({ user: data.user, session: data.session });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/profile — update own profile metadata
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { full_name, phone, upi_id, is_host } = req.body;

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (upi_id !== undefined) updates.upi_id = upi_id;
    if (is_host !== undefined) updates.is_host = is_host;

    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ user: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh — refresh access token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token is required' });

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ error: error.message });

    return res.json({ session: data.session });
  } catch (err) {
    next(err);
  }
});

export default router;
