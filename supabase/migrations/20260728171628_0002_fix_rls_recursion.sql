-- Fix infinite recursion in profiles RLS policies
-- The problem: policies on profiles query profiles itself (SELECT 1 FROM profiles WHERE ...)
-- which triggers RLS on profiles -> infinite recursion.
-- Solution: create a SECURITY DEFINER function that checks the role without RLS.

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'manager'
  );
$$;

-- Now drop and recreate all profiles policies using is_manager() instead of subqueries
DROP POLICY IF EXISTS "profile_self_read" ON profiles;
CREATE POLICY "profile_self_read" ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_manager());

DROP POLICY IF EXISTS "profile_self_upsert" ON profiles;
CREATE POLICY "profile_self_upsert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profile_self_update" ON profiles;
CREATE POLICY "profile_self_update" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_manager())
  WITH CHECK (auth.uid() = id OR public.is_manager());

DROP POLICY IF EXISTS "profile_manager_insert" ON profiles;
CREATE POLICY "profile_manager_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

-- Also fix all other tables that reference profiles in RLS policies
-- to use is_manager() instead of subqueries

-- departments
DROP POLICY IF EXISTS "dept_manage_managers" ON departments;
CREATE POLICY "dept_manage_managers" ON departments FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS "dept_update_managers" ON departments;
CREATE POLICY "dept_update_managers" ON departments FOR UPDATE TO authenticated USING (public.is_manager());

-- allowed_locations
DROP POLICY IF EXISTS "loc_manage_managers" ON allowed_locations;
CREATE POLICY "loc_manage_managers" ON allowed_locations FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS "loc_update_managers" ON allowed_locations;
CREATE POLICY "loc_update_managers" ON allowed_locations FOR UPDATE TO authenticated USING (public.is_manager());
DROP POLICY IF EXISTS "loc_delete_managers" ON allowed_locations;
CREATE POLICY "loc_delete_managers" ON allowed_locations FOR DELETE TO authenticated USING (public.is_manager());

-- attendance
DROP POLICY IF EXISTS "att_select_own_or_manager" ON attendance;
CREATE POLICY "att_select_own_or_manager" ON attendance FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "att_update_own_or_manager" ON attendance;
CREATE POLICY "att_update_own_or_manager" ON attendance FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager())
  WITH CHECK (auth.uid() = user_id OR public.is_manager());

-- shifts
DROP POLICY IF EXISTS "shift_select_own_or_manager" ON shifts;
CREATE POLICY "shift_select_own_or_manager" ON shifts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "shift_insert_manager" ON shifts;
CREATE POLICY "shift_insert_manager" ON shifts FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());
DROP POLICY IF EXISTS "shift_update_manager" ON shifts;
CREATE POLICY "shift_update_manager" ON shifts FOR UPDATE TO authenticated USING (public.is_manager());
DROP POLICY IF EXISTS "shift_delete_manager" ON shifts;
CREATE POLICY "shift_delete_manager" ON shifts FOR DELETE TO authenticated USING (public.is_manager());

-- requests
DROP POLICY IF EXISTS "req_select_own_or_manager" ON requests;
CREATE POLICY "req_select_own_or_manager" ON requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "req_update_own_or_manager" ON requests;
CREATE POLICY "req_update_own_or_manager" ON requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager())
  WITH CHECK (auth.uid() = user_id OR public.is_manager());

-- notifications
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "notif_insert_own_or_manager" ON notifications;
CREATE POLICY "notif_insert_own_or_manager" ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager())
  WITH CHECK (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());

-- expenses
DROP POLICY IF EXISTS "exp_select_own_or_manager" ON expenses;
CREATE POLICY "exp_select_own_or_manager" ON expenses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "exp_insert_own_or_manager" ON expenses;
CREATE POLICY "exp_insert_own_or_manager" ON expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "exp_update_own_or_manager" ON expenses;
CREATE POLICY "exp_update_own_or_manager" ON expenses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager())
  WITH CHECK (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "exp_delete_own_or_manager" ON expenses;
CREATE POLICY "exp_delete_own_or_manager" ON expenses FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());

-- tasks
DROP POLICY IF EXISTS "task_select_own_or_manager" ON tasks;
CREATE POLICY "task_select_own_or_manager" ON tasks FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = assignee_id OR public.is_manager());
DROP POLICY IF EXISTS "task_insert_own_or_manager" ON tasks;
CREATE POLICY "task_insert_own_or_manager" ON tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_manager());
DROP POLICY IF EXISTS "task_update_own_or_manager" ON tasks;
CREATE POLICY "task_update_own_or_manager" ON tasks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = assignee_id OR public.is_manager())
  WITH CHECK (auth.uid() = user_id OR auth.uid() = assignee_id OR public.is_manager());
DROP POLICY IF EXISTS "task_delete_own_or_manager" ON tasks;
CREATE POLICY "task_delete_own_or_manager" ON tasks FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_manager());
