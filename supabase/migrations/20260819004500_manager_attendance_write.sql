-- Managers can insert/delete employee attendance rows from the app.

DROP POLICY IF EXISTS "att_insert_own_or_manager" ON attendance;
DROP POLICY IF EXISTS "att_insert_own" ON attendance;
CREATE POLICY "att_insert_own_or_manager" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_manager());

DROP POLICY IF EXISTS "att_delete_own_or_manager" ON attendance;
DROP POLICY IF EXISTS "att_delete_own" ON attendance;
CREATE POLICY "att_delete_own_or_manager" ON attendance
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());

CREATE OR REPLACE FUNCTION public.manager_insert_attendance(
  p_user_id uuid,
  p_clock_in timestamptz,
  p_clock_out timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'רק מנהל יכול להוסיף דיווח';
  END IF;
  INSERT INTO public.attendance (
    user_id, clock_in, clock_out, lat, lng, location_verified, qr_verified, note, status
  ) VALUES (
    p_user_id, p_clock_in, p_clock_out, NULL, NULL, false, false, 'נוסף ידנית על ידי מנהל', 'approved'
  )
  RETURNING id INTO rid;
  RETURN rid;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_delete_attendance(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'רק מנהל יכול למחוק דיווח';
  END IF;
  DELETE FROM public.attendance WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.manager_insert_attendance(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_insert_attendance(uuid, timestamptz, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.manager_delete_attendance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_delete_attendance(uuid) TO authenticated;
