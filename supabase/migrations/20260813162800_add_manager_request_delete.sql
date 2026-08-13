-- Allow managers to delete employee requests
DROP POLICY IF EXISTS "req_delete_manager" ON requests;
CREATE POLICY "req_delete_manager" ON requests FOR DELETE TO authenticated
  USING (public.is_manager());
