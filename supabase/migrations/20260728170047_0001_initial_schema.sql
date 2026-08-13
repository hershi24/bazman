/*
# EZ TIME — Initial schema for attendance, shift & request management

1. Overview
A Hebrew RTL employee attendance, GPS/QR tracking and shift-management app.
Roles: 'manager' and 'employee'. Auth is Supabase email/password.

2. New Tables
- `departments` — company departments / suppliers.
- `profiles` — extends auth.users with role + display info.
- `allowed_locations` — geofencing points permitted for clock-in.
- `attendance` — clock-in/out events with GPS verification.
- `shifts` — scheduled shifts per employee.
- `requests` — employee requests (shift change / hour adjustment / leave / sick).
- `notifications` — manager/employee notifications.
- `reminders` — manager reminders.
- `expenses` — expenses / additions per employee per month.
- `tasks` — task management items.

3. Security
- RLS enabled on every table.
- Profiles: each authenticated user reads/updates own row; managers read all.
- All other tables: owner-scoped CRUD for employees; managers read all + update status fields.
- Owner columns default to auth.uid() so client inserts omitting user_id succeed.
*/

-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('manager','employee')),
  full_name text NOT NULL,
  employee_number text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  phone text,
  avatar_url text,
  birth_date date,
  hire_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allowed_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  radius_meters int NOT NULL DEFAULT 150,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  clock_in timestamptz,
  clock_out timestamptz,
  lat numeric,
  lng numeric,
  location_verified boolean NOT NULL DEFAULT false,
  qr_verified boolean NOT NULL DEFAULT false,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  role_project text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  description text,
  requested_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  manager_note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  month date NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done')),
  due_date date,
  created_at timestamptz DEFAULT now()
);

-- ============ RLS ENABLE ============
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- departments
DROP POLICY IF EXISTS "dept_read_all" ON departments;
CREATE POLICY "dept_read_all" ON departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dept_manage_managers" ON departments;
CREATE POLICY "dept_manage_managers" ON departments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
);
DROP POLICY IF EXISTS "dept_update_managers" ON departments;
CREATE POLICY "dept_update_managers" ON departments FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
);

-- profiles
DROP POLICY IF EXISTS "profile_self_read" ON profiles;
CREATE POLICY "profile_self_read" ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "profile_self_upsert" ON profiles;
CREATE POLICY "profile_self_upsert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profile_self_update" ON profiles;
CREATE POLICY "profile_self_update" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'))
  WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "profile_manager_insert" ON profiles;
CREATE POLICY "profile_manager_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- allowed_locations
DROP POLICY IF EXISTS "loc_read_all" ON allowed_locations;
CREATE POLICY "loc_read_all" ON allowed_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "loc_manage_managers" ON allowed_locations;
CREATE POLICY "loc_manage_managers" ON allowed_locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager'));
DROP POLICY IF EXISTS "loc_update_managers" ON allowed_locations;
CREATE POLICY "loc_update_managers" ON allowed_locations FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
);
DROP POLICY IF EXISTS "loc_delete_managers" ON allowed_locations;
CREATE POLICY "loc_delete_managers" ON allowed_locations FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
);

-- attendance
DROP POLICY IF EXISTS "att_select_own_or_manager" ON attendance;
CREATE POLICY "att_select_own_or_manager" ON attendance FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "att_insert_own" ON attendance;
CREATE POLICY "att_insert_own" ON attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "att_update_own_or_manager" ON attendance;
CREATE POLICY "att_update_own_or_manager" ON attendance FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "att_delete_own" ON attendance;
CREATE POLICY "att_delete_own" ON attendance FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- shifts
DROP POLICY IF EXISTS "shift_select_own_or_manager" ON shifts;
CREATE POLICY "shift_select_own_or_manager" ON shifts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "shift_insert_manager" ON shifts;
CREATE POLICY "shift_insert_manager" ON shifts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "shift_update_manager" ON shifts;
CREATE POLICY "shift_update_manager" ON shifts FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
);
DROP POLICY IF EXISTS "shift_delete_manager" ON shifts;
CREATE POLICY "shift_delete_manager" ON shifts FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
);

-- requests
DROP POLICY IF EXISTS "req_select_own_or_manager" ON requests;
CREATE POLICY "req_select_own_or_manager" ON requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "req_insert_own" ON requests;
CREATE POLICY "req_insert_own" ON requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "req_update_own_or_manager" ON requests;
CREATE POLICY "req_update_own_or_manager" ON requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "req_delete_own" ON requests;
CREATE POLICY "req_delete_own" ON requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notifications
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "notif_insert_own_or_manager" ON notifications;
CREATE POLICY "notif_insert_own_or_manager" ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- reminders
DROP POLICY IF EXISTS "rem_select_own" ON reminders;
CREATE POLICY "rem_select_own" ON reminders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "rem_insert_own" ON reminders;
CREATE POLICY "rem_insert_own" ON reminders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rem_update_own" ON reminders;
CREATE POLICY "rem_update_own" ON reminders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rem_delete_own" ON reminders;
CREATE POLICY "rem_delete_own" ON reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- expenses
DROP POLICY IF EXISTS "exp_select_own_or_manager" ON expenses;
CREATE POLICY "exp_select_own_or_manager" ON expenses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "exp_insert_own_or_manager" ON expenses;
CREATE POLICY "exp_insert_own_or_manager" ON expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "exp_update_own_or_manager" ON expenses;
CREATE POLICY "exp_update_own_or_manager" ON expenses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "exp_delete_own_or_manager" ON expenses;
CREATE POLICY "exp_delete_own_or_manager" ON expenses FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- tasks
DROP POLICY IF EXISTS "task_select_own_or_manager" ON tasks;
CREATE POLICY "task_select_own_or_manager" ON tasks FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = assignee_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "task_insert_own_or_manager" ON tasks;
CREATE POLICY "task_insert_own_or_manager" ON tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "task_update_own_or_manager" ON tasks;
CREATE POLICY "task_update_own_or_manager" ON tasks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = assignee_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'))
  WITH CHECK (auth.uid() = user_id OR auth.uid() = assignee_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
DROP POLICY IF EXISTS "task_delete_own_or_manager" ON tasks;
CREATE POLICY "task_delete_own_or_manager" ON tasks FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_clock_in ON attendance(clock_in);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_start ON shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department_id);
