/*
# Link allowed locations to specific employees

1. New Tables
- `employee_locations` — many-to-many link between `allowed_locations` and `profiles`.
  - `id` uuid PK
  - `location_id` uuid FK -> allowed_locations ON DELETE CASCADE
  - `employee_id` uuid FK -> profiles ON DELETE CASCADE
  - `created_at` timestamptz
  - UNIQUE constraint on (location_id, employee_id) to prevent duplicates.

2. Security
- RLS enabled.
- SELECT: any authenticated user can read.
- INSERT/DELETE: managers only.
*/

CREATE TABLE IF NOT EXISTS employee_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES allowed_locations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (location_id, employee_id)
);

ALTER TABLE employee_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "el_select_all" ON employee_locations;
CREATE POLICY "el_select_all" ON employee_locations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "el_manage_managers" ON employee_locations;
CREATE POLICY "el_manage_managers" ON employee_locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));

DROP POLICY IF EXISTS "el_delete_managers" ON employee_locations;
CREATE POLICY "el_delete_managers" ON employee_locations FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
);
