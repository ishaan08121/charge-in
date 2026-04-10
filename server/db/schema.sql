-- ============================================================
-- Charge.in — Database Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─── users ───────────────────────────────────────────────────────────────────
-- Mirrors auth.users; stores app-specific profile fields.
CREATE TABLE IF NOT EXISTS public.users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  full_name        TEXT,
  phone            TEXT UNIQUE,
  is_host          BOOLEAN NOT NULL DEFAULT FALSE,
  upi_id           TEXT,
  expo_push_token  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── chargers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chargers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  address          TEXT,
  city             TEXT,
  state            TEXT,
  location         GEOGRAPHY(POINT, 4326) NOT NULL,  -- PostGIS point (lng, lat)
  connector_types  TEXT[] NOT NULL DEFAULT '{}',      -- e.g. ['Type2', 'CCS2']
  power_kw         NUMERIC(6,2) NOT NULL,
  price_per_kwh    NUMERIC(8,2) NOT NULL,             -- INR per kWh
  is_available     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for proximity queries
CREATE INDEX IF NOT EXISTS chargers_location_idx ON public.chargers USING GIST (location);

-- ─── charger_photos ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.charger_photos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  charger_id  UUID NOT NULL REFERENCES public.chargers(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── availability_slots ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  charger_id    UUID NOT NULL REFERENCES public.chargers(id) ON DELETE CASCADE,
  day_of_week   SMALLINT,        -- 0=Sun … 6=Sat (NULL = specific date)
  specific_date DATE,            -- for one-off dates
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_recurring  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT day_or_date CHECK (
    (day_of_week IS NOT NULL AND specific_date IS NULL) OR
    (day_of_week IS NULL AND specific_date IS NOT NULL)
  )
);

-- ─── bookings ─────────────────────────────────────────────────────────────────
CREATE TYPE booking_status AS ENUM (
  'pending',    -- payment held, awaiting host response
  'confirmed',  -- host accepted, payment captured
  'active',     -- charging in progress
  'completed',  -- session ended
  'cancelled',  -- user cancelled
  'declined'    -- host declined or auto-expired
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.users(id),
  charger_id            UUID NOT NULL REFERENCES public.chargers(id),
  host_id               UUID NOT NULL REFERENCES public.users(id),
  start_time            TIMESTAMPTZ NOT NULL,
  end_time              TIMESTAMPTZ NOT NULL,
  status                booking_status NOT NULL DEFAULT 'pending',
  razorpay_order_id     TEXT NOT NULL UNIQUE,
  razorpay_payment_id   TEXT,
  amount_held           BIGINT NOT NULL DEFAULT 0,  -- paise
  otp                   CHAR(4),                    -- for session start verification
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_time_valid CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS bookings_charger_time_idx ON public.bookings (charger_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON public.bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_host_idx ON public.bookings (host_id);

-- ─── sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id   UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  units_kwh    NUMERIC(8,3),
  final_amount BIGINT        -- paise (actual charged)
);

-- ─── reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id   UUID NOT NULL UNIQUE REFERENCES public.bookings(id),
  charger_id   UUID NOT NULL REFERENCES public.chargers(id),
  reviewer_id  UUID NOT NULL REFERENCES public.users(id),
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_charger_idx ON public.reviews (charger_id);

-- ─── payouts ──────────────────────────────────────────────────────────────────
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');

CREATE TABLE IF NOT EXISTS public.payouts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id          UUID NOT NULL REFERENCES public.bookings(id),
  host_id             UUID NOT NULL REFERENCES public.users(id),
  amount              BIGINT NOT NULL,  -- paise
  status              payout_status NOT NULL DEFAULT 'pending',
  razorpay_payout_id  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payouts_host_idx ON public.payouts (host_id);

-- ─── Supabase Storage bucket ──────────────────────────────────────────────────
-- Run via Supabase dashboard or storage API — SQL only for reference:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('charger-photos', 'charger-photos', true);

-- ─── get_nearby_chargers RPC ─────────────────────────────────────────────────
-- Called from routes/chargers.js GET /nearby
CREATE OR REPLACE FUNCTION public.get_nearby_chargers(
  user_lat  DOUBLE PRECISION,
  user_lng  DOUBLE PRECISION,
  radius_m  DOUBLE PRECISION DEFAULT 10000
)
RETURNS TABLE (
  id               UUID,
  host_id          UUID,
  title            TEXT,
  description      TEXT,
  address          TEXT,
  city             TEXT,
  connector_types  TEXT[],
  power_kw         NUMERIC,
  price_per_kwh    NUMERIC,
  is_available     BOOLEAN,
  distance_m       DOUBLE PRECISION,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.host_id,
    c.title,
    c.description,
    c.address,
    c.city,
    c.connector_types,
    c.power_kw,
    c.price_per_kwh,
    c.is_available,
    ST_Distance(c.location, ST_MakePoint(user_lng, user_lat)::GEOGRAPHY) AS distance_m,
    ST_Y(c.location::GEOMETRY) AS latitude,
    ST_X(c.location::GEOMETRY) AS longitude
  FROM public.chargers c
  WHERE
    c.is_available = TRUE
    AND ST_DWithin(
      c.location,
      ST_MakePoint(user_lng, user_lat)::GEOGRAPHY,
      radius_m
    )
  ORDER BY distance_m ASC;
$$;

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Backend uses service key (RLS bypassed), but enable for anon/mobile clients.

ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chargers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charger_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts        ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own row
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Chargers: public read, host can insert/update/delete
CREATE POLICY "chargers_select_all"   ON public.chargers FOR SELECT USING (true);
CREATE POLICY "chargers_insert_host"  ON public.chargers FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "chargers_update_host"  ON public.chargers FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "chargers_delete_host"  ON public.chargers FOR DELETE USING (auth.uid() = host_id);

-- Photos: public read, host can insert
CREATE POLICY "photos_select_all"    ON public.charger_photos FOR SELECT USING (true);
CREATE POLICY "photos_insert_host"   ON public.charger_photos FOR INSERT
  WITH CHECK (auth.uid() = (SELECT host_id FROM public.chargers WHERE id = charger_id));

-- Availability: public read, host can manage
CREATE POLICY "avail_select_all"  ON public.availability_slots FOR SELECT USING (true);
CREATE POLICY "avail_host_manage" ON public.availability_slots FOR ALL
  USING (auth.uid() = (SELECT host_id FROM public.chargers WHERE id = charger_id));

-- Bookings: user or host can view/manage own bookings
CREATE POLICY "bookings_user_host" ON public.bookings FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = host_id);

-- Sessions: user or host can view
CREATE POLICY "sessions_view" ON public.sessions FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.bookings WHERE id = booking_id)
      OR auth.uid() = (SELECT host_id FROM public.bookings WHERE id = booking_id));

-- Reviews: public read, reviewer can insert
CREATE POLICY "reviews_select_all"    ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own"    ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Payouts: only host can view own payouts
CREATE POLICY "payouts_host_view" ON public.payouts FOR SELECT USING (auth.uid() = host_id);
