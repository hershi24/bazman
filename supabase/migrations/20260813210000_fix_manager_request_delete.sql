-- Managers (and the request owner) must be able to delete employee requests.
-- Previous policy only allowed the employee who created the request, so the
-- manager "delete" button appeared to succeed but RLS dropped the row silently.
DROP POLICY IF EXISTS "req_delete_own" ON requests;
DROP POLICY IF EXISTS "req_delete_manager" ON requests;
DROP POLICY IF EXISTS "req_delete_own_or_manager" ON requests;

CREATE POLICY "req_delete_own_or_manager" ON requests
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());
