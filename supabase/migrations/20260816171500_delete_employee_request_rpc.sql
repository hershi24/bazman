-- Managers can fully delete employee requests (bypasses table RLS after role check)
CREATE OR REPLACE FUNCTION public.delete_employee_request(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean;
BEGIN
  SELECT
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'e0583296967@gmail.com'
    INTO allowed;
  IF NOT COALESCE(allowed, false) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.notifications n
  USING public.requests r
  WHERE r.id = p_id
    AND n.user_id = r.user_id
    AND n.title IN ('הבקשה שלך אושרה', 'הבקשה שלך נדחתה', 'תגובה לבקשה שלך');

  DELETE FROM public.requests WHERE id = p_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_employee_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_employee_request(uuid) TO authenticated;

DROP POLICY IF EXISTS "req_delete_own" ON requests;
DROP POLICY IF EXISTS "req_delete_manager" ON requests;
DROP POLICY IF EXISTS "req_delete_own_or_manager" ON requests;
CREATE POLICY "req_delete_own_or_manager" ON requests FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());
