-- Create employees/managers from the app without the edge function.
-- Confirms email immediately so the new user can sign in.

CREATE OR REPLACE FUNCTION public.create_staff_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text DEFAULT 'employee',
  p_phone text DEFAULT NULL,
  p_employee_number text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  uid uuid;
  email_norm text;
  role_norm text;
  caller_email text;
BEGIN
  caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF NOT public.is_manager() AND caller_email <> 'e0583296967@gmail.com' THEN
    RAISE EXCEPTION 'רק מנהל יכול להוסיף משתמשים';
  END IF;

  email_norm := lower(trim(p_email));
  IF email_norm = '' OR trim(p_full_name) = '' OR coalesce(p_password, '') = '' THEN
    RAISE EXCEPTION 'חסרים שם, אימייל או סיסמה';
  END IF;
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'הסיסמה חייבת להכיל לפחות 6 תווים';
  END IF;
  IF email_norm = 'e0583296967@gmail.com' THEN
    RAISE EXCEPTION 'לא ניתן להשתמש באימייל של חשבון המפתחים';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = email_norm) THEN
    RAISE EXCEPTION 'האימייל כבר קיים במערכת';
  END IF;

  role_norm := CASE WHEN p_role = 'manager' THEN 'manager' ELSE 'employee' END;
  uid := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    uid,
    'authenticated',
    'authenticated',
    email_norm,
    crypt(p_password, gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', trim(p_full_name), 'role', role_norm),
    now(),
    now(),
    false,
    false,
    false
  );

  INSERT INTO auth.identities (
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    uid,
    uid::text,
    jsonb_build_object('sub', uid::text, 'email', email_norm),
    'email',
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    employee_number,
    department_id,
    phone,
    status,
    hidden
  ) VALUES (
    uid,
    role_norm,
    trim(p_full_name),
    CASE WHEN role_norm = 'manager' THEN NULL ELSE nullif(p_employee_number, '') END,
    CASE WHEN role_norm = 'manager' THEN NULL ELSE p_department_id END,
    nullif(p_phone, ''),
    'active',
    false
  );

  RETURN uid;
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_user(text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_staff_user(text, text, text, text, text, text, uuid) TO authenticated;
