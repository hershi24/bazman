CREATE TABLE IF NOT EXISTS profile_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  key text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','number','date','phone','email','select')),
  options text,
  required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profile_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pf_select_all" ON profile_fields;
CREATE POLICY "pf_select_all" ON profile_fields FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pf_manage_managers" ON profile_fields;
CREATE POLICY "pf_manage_managers" ON profile_fields FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "pf_update_managers" ON profile_fields;
CREATE POLICY "pf_update_managers" ON profile_fields FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
);

DROP POLICY IF EXISTS "pf_delete_managers" ON profile_fields;
CREATE POLICY "pf_delete_managers" ON profile_fields FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
);

INSERT INTO profile_fields (label, key, type, required, active, sort_order) VALUES
  ('שם מלא', 'full_name', 'text', true, true, 1),
  ('מספר עובד', 'employee_number', 'text', false, true, 2),
  ('טלפון', 'phone', 'phone', false, true, 3),
  ('תאריך לידה', 'birth_date', 'date', false, true, 4),
  ('תאריך הצטרפות', 'hire_date', 'date', false, true, 5),
  ('מחלקה', 'department_id', 'select', false, true, 6),
  ('אימייל', 'email', 'email', true, true, 7)
ON CONFLICT (key) DO NOTHING;
