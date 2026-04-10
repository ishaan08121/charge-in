import { Router } from 'express';
import supabase from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/chargers — list a new charger
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      title, description, address, city, state,
      latitude, longitude,
      connector_types, power_kw, price_per_kwh, location_type,
    } = req.body;

    if (!title || !latitude || !longitude || !price_per_kwh || !power_kw) {
      return res.status(400).json({ error: 'title, latitude, longitude, power_kw and price_per_kwh are required' });
    }

    // Ensure the user has is_host=true
    const { data: userRow } = await supabase
      .from('users')
      .select('is_host')
      .eq('id', req.userId)
      .single();

    if (!userRow?.is_host) {
      // Auto-upgrade to host on first charger listing
      await supabase.from('users').update({ is_host: true }).eq('id', req.userId);
    }

    const { data, error } = await supabase
      .from('chargers')
      .insert({
        host_id: req.userId,
        title,
        description: description || null,
        address: address || null,
        city: city || null,
        state: state || null,
        // PostGIS geography point stored via WKT
        location: `POINT(${longitude} ${latitude})`,
        connector_types: connector_types || [],
        power_kw,
        price_per_kwh,
        location_type: location_type || 'home',
        is_available: true,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ charger: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/chargers/:id/slots?date=YYYY-MM-DD — booked slots for a charger on a date
router.get('/:id/slots', requireAuth, async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd   = new Date(`${date}T23:59:59.999Z`);

    const { data, error } = await supabase
      .from('bookings')
      .select('start_time, end_time, status')
      .eq('charger_id', req.params.id)
      .in('status', ['pending', 'confirmed', 'active'])
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString());

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ booked_slots: data });
  } catch (err) { next(err); }
});

// GET /api/chargers/mine — get all chargers listed by the logged-in host
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('chargers')
      .select('*, charger_photos(id, url)')
      .eq('host_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ chargers: data });
  } catch (err) { next(err); }
});

// GET /api/chargers/nearby?lat=&lng=&radius_km=&connector_type=
router.get('/nearby', requireAuth, async (req, res, next) => {
  try {
    const { lat, lng, radius_km = 10, connector_type } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    const radiusMeters = parseFloat(radius_km) * 1000;

    let query = supabase.rpc('get_nearby_chargers', {
      user_lat: parseFloat(lat),
      user_lng: parseFloat(lng),
      radius_m: radiusMeters,
    });

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    // Optional client-side filter by connector type
    const results = connector_type
      ? data.filter((c) => c.connector_types?.includes(connector_type))
      : data;

    return res.json({ chargers: results });
  } catch (err) {
    next(err);
  }
});

// GET /api/chargers/:id — get single charger with photos and host info
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('chargers')
      .select(`
        *,
        host:users!chargers_host_id_fkey(id, full_name),
        charger_photos(id, url),
        availability_slots(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Charger not found' });
    return res.json({ charger: data });
  } catch (err) {
    next(err);
  }
});

// PUT /api/chargers/:id — update charger (host only)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('chargers')
      .select('host_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr) return res.status(404).json({ error: 'Charger not found' });
    if (existing.host_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const allowed = ['title', 'description', 'address', 'city', 'state',
      'connector_types', 'power_kw', 'price_per_kwh', 'is_available', 'location_type'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Handle location update
    if (req.body.latitude && req.body.longitude) {
      updates.location = `POINT(${req.body.longitude} ${req.body.latitude})`;
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('chargers')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ charger: data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chargers/:id — delete charger (host only)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('chargers')
      .select('host_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr) return res.status(404).json({ error: 'Charger not found' });
    if (existing.host_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const { error } = await supabase.from('chargers').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ message: 'Charger deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/chargers/:id/photos — upload a photo to Supabase Storage
router.post('/:id/photos', requireAuth, async (req, res, next) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('chargers')
      .select('host_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr) return res.status(404).json({ error: 'Charger not found' });
    if (existing.host_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    // Expect base64 encoded image in body: { base64, mime_type }
    const { base64, mime_type = 'image/jpeg' } = req.body;
    if (!base64) return res.status(400).json({ error: 'base64 image data is required' });

    const buffer = Buffer.from(base64, 'base64');
    const ext = mime_type.split('/')[1] || 'jpg';
    const filename = `${req.params.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('charger-photos')
      .upload(filename, buffer, { contentType: mime_type, upsert: false });

    if (uploadErr) return res.status(400).json({ error: uploadErr.message });

    const { data: { publicUrl } } = supabase.storage
      .from('charger-photos')
      .getPublicUrl(filename);

    const { data: photo, error: dbErr } = await supabase
      .from('charger_photos')
      .insert({ charger_id: req.params.id, url: publicUrl })
      .select()
      .single();

    if (dbErr) return res.status(400).json({ error: dbErr.message });
    return res.status(201).json({ photo });
  } catch (err) {
    next(err);
  }
});

export default router;
