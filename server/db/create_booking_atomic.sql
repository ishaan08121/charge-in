-- ============================================================
-- create_booking_atomic — Postgres function
-- Atomically checks for booking conflicts and creates booking.
-- Called from routes/bookings.js POST /confirm via supabase.rpc()
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_user_id             UUID,
  p_charger_id          UUID,
  p_host_id             UUID,
  p_start_time          TIMESTAMPTZ,
  p_end_time            TIMESTAMPTZ,
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_amount_held         BIGINT
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as the function owner (postgres), bypasses RLS
AS $$
DECLARE
  v_conflict_count  INT;
  v_booking         public.bookings;
  v_otp             CHAR(4);
BEGIN
  -- 1. Lock the charger row to prevent concurrent inserts
  PERFORM 1 FROM public.chargers WHERE id = p_charger_id FOR UPDATE;

  -- 2. Check for overlapping active bookings on this charger
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.bookings
  WHERE
    charger_id = p_charger_id
    AND status IN ('pending', 'confirmed', 'active')
    AND tstzrange(start_time, end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)');

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Time slot is no longer available (conflict detected)'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Generate a 4-digit OTP for session start
  v_otp := LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

  -- 4. Insert the booking
  INSERT INTO public.bookings (
    user_id,
    charger_id,
    host_id,
    start_time,
    end_time,
    status,
    razorpay_order_id,
    razorpay_payment_id,
    amount_held,
    otp
  )
  VALUES (
    p_user_id,
    p_charger_id,
    p_host_id,
    p_start_time,
    p_end_time,
    'pending',
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_amount_held,
    v_otp
  )
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- Grant execute to authenticated users (service key bypasses this, but include for completeness)
GRANT EXECUTE ON FUNCTION public.create_booking_atomic(
  UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, BIGINT
) TO authenticated;

-- ============================================================
-- Additional helpful RPC: get booking OTP (user only)
-- The OTP is sensitive — only the booking owner should retrieve it
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_booking_otp(p_booking_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_otp TEXT;
  v_user_id UUID;
BEGIN
  SELECT user_id, otp INTO v_user_id, v_otp
  FROM public.bookings
  WHERE id = p_booking_id;

  -- Only the booking user can retrieve the OTP
  IF v_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_otp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_otp(UUID) TO authenticated;
