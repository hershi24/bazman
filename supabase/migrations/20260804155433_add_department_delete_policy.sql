-- Allow managers to delete departments
CREATE POLICY "dept_delete_managers" ON departments FOR DELETE
  TO authenticated USING (is_manager());