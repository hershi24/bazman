-- Allow managers to create an attendance row when approving an hours-adjustment
-- for a day that has no existing clock-in.

DROP POLICY IF EXISTS "att_insert_own_or_manager" ON attendance;
DROP POLICY IF EXISTS "att_insert_own" ON attendance;

CREATE POLICY "att_insert_own_or_manager" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_manager());
