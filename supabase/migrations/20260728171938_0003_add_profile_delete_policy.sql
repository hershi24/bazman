-- Add delete policy for profiles (soft delete by managers)
DROP POLICY IF EXISTS "profile_delete_manager" ON profiles;
CREATE POLICY "profile_delete_manager" ON profiles FOR DELETE TO authenticated
  USING (public.is_manager());