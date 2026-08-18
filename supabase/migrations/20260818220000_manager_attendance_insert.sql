-- Allow managers to create/update attendance when approving an hours adjustment.

DROP POLICY IF EXISTS "att_insert_own_or_manager" ON attendance;
DROP POLICY IF EXISTS "att_insert_own" ON attendance;

CREATE POLICY "att_insert_own_or_manager" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_manager());

CREATE OR REPLACE FUNCTION public.apply_hours_adjustment(
  p_user_id uuid,
  p_date date,
  p_clock_in text DEFAULT NULL,
  p_clock_out text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.attendance%ROWTYPE;
  new_in timestamptz;
  new_out timestamptz;
  rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'רק מנהל יכול לעדכן שעות';
  END IF;
  IF p_clock_in IS NULL AND p_clock_out IS NULL THEN
    RAISE EXCEPTION 'חסרה שעת כניסה או יציאה';
  END IF;

  IF p_clock_in IS NOT NULL THEN
    new_in := (p_date::text || 'T' || p_clock_in || ':00')::timestamp AT TIME ZONE 'Asia/Jerusalem';
  END IF;
  IF p_clock_out IS NOT NULL THEN
    new_out := (p_date::text || 'T' || p_clock_out || ':00')::timestamp AT TIME ZONE 'Asia/Jerusalem';
  END IF;

  SELECT * INTO rec
  FROM public.attendance a
  WHERE a.user_id = p_user_id
    AND timezone('Asia/Jerusalem', a.clock_in)::date = p_date
  ORDER BY a.clock_in
  LIMIT 1;

  IF rec.id IS NOT NULL THEN
    UPDATE public.attendance
    SET
      clock_in = COALESCE(new_in, rec.clock_in),
      clock_out = COALESCE(new_out, rec.clock_out)
    WHERE id = rec.id;
    RETURN rec.id;
  END IF;

  IF new_in IS NULL THEN
    RAISE EXCEPTION 'אין דיווח ביום זה. צריך גם שעת כניסה כדי ליצור דיווח';
  END IF;

  INSERT INTO public.attendance (
    user_id, clock_in, clock_out, lat, lng, location_verified, qr_verified, note, status
  ) VALUES (
    p_user_id, new_in, new_out, NULL, NULL, false, false, 'עודכן מאישור התאמת שעות', 'approved'
  )
  RETURNING id INTO rid;

  RETURN rid;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_hours_adjustment(uuid, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_hours_adjustment(uuid, date, text, text) TO authenticated;

