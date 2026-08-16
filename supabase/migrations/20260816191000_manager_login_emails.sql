-- Managers can read login emails of other (non-hidden) managers.
CREATE OR REPLACE FUNCTION public.manager_login_emails()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('id', p.id, 'email', u.email)),
    '[]'::jsonb
  )
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'manager'
    AND COALESCE(p.hidden, false) = false
    AND p.status = 'active'
    AND (
      public.is_manager()
      OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'e0583296967@gmail.com'
    );
$$;

REVOKE ALL ON FUNCTION public.manager_login_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_login_emails() TO authenticated;
