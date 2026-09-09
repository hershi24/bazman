CREATE TABLE IF NOT EXISTS developer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'הערה',
  message text NOT NULL,
  sender_name text,
  sender_email text,
  employee_number text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE developer_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "devfb_insert_own" ON developer_feedback;
CREATE POLICY "devfb_insert_own" ON developer_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "devfb_select_own_or_manager" ON developer_feedback;
CREATE POLICY "devfb_select_own_or_manager" ON developer_feedback
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
  );
