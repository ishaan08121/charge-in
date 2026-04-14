import { Router } from 'express';
import multer from 'multer';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/users/me — get own profile (auto-creates row if missing)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();

    // Row missing — fetch from auth and auto-create
    if (error) {
      const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(req.userId);
      if (authErr || !authData?.user) return res.status(404).json({ error: 'User not found' });

      const authUser = authData.user;
      const { data: created, error: insertErr } = await supabase
        .from('users')
        .insert({
          id: req.userId,
          email: authUser.email || null,
          full_name: authUser.user_metadata?.full_name || null,
          phone: authUser.phone || authUser.user_metadata?.phone || null,
        })
        .select()
        .single();

      if (insertErr) return res.status(500).json({ error: 'Could not create user profile' });
      data = created;
    }

    return res.json({ user: data });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/me — update own profile
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { full_name, phone, upi_id, is_host, ev_make, ev_model, ev_battery_kwh, ev_connector_type } = req.body;

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (upi_id !== undefined) updates.upi_id = upi_id;
    if (is_host !== undefined) updates.is_host = is_host;
    if (ev_make !== undefined) updates.ev_make = ev_make;
    if (ev_model !== undefined) updates.ev_model = ev_model;
    if (ev_battery_kwh !== undefined) updates.ev_battery_kwh = ev_battery_kwh;
    if (ev_connector_type !== undefined) updates.ev_connector_type = ev_connector_type;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.userId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ user: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/push-token — save Expo push token
router.post('/push-token', requireAuth, async (req, res, next) => {
  try {
    const { expo_push_token } = req.body;
    if (!expo_push_token) {
      return res.status(400).json({ error: 'expo_push_token is required' });
    }

    const { error } = await supabase
      .from('users')
      .update({ expo_push_token, updated_at: new Date().toISOString() })
      .eq('id', req.userId);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ message: 'Push token saved' });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — get public profile of any user (for charger detail page)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, phone, is_host, created_at')
      .eq('id', req.params.id)
      .single();

    if (!error && data) return res.json({ user: data });

    // Row missing — fallback to auth metadata
    const { data: authData } = await supabase.auth.admin.getUserById(req.params.id);
    if (!authData?.user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      user: {
        id: authData.user.id,
        full_name: authData.user.user_metadata?.full_name || null,
        phone: authData.user.phone || authData.user.user_metadata?.phone || null,
        is_host: false,
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/avatar — upload profile photo to Supabase Storage
router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const path = `avatars/${req.userId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadErr) return res.status(500).json({ error: uploadErr.message });

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatar_url = urlData.publicUrl;

    await supabase
      .from('users')
      .update({ avatar_url, updated_at: new Date().toISOString() })
      .eq('id', req.userId);

    return res.json({ avatar_url });
  } catch (err) {
    next(err);
  }
});

export default router;
