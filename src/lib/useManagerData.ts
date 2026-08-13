import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  Attendance,
  EmployeeRequest,
  Profile,
  Shift,
  Reminder,
  Task,
  Expense,
  AppNotification,
  Department,
  ProfileField,
  AllowedLocation,
  EmployeeLocation,
} from '@/types';

export function useManagerData() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [profileFields, setProfileFields] = useState<ProfileField[]>([]);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [employeeLocations, setEmployeeLocations] = useState<EmployeeLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [p, d, a, r, s, rem, t, e, n, pf, al, el] = await Promise.all([
      supabase.from('profiles').select('*, department:departments(*)').order('full_name'),
      supabase.from('departments').select('*').order('name'),
      supabase
        .from('attendance')
        .select('*, profile:profiles(*, department:departments(*))')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('requests')
        .select('*, profile:profiles(*, department:departments(*))')
        .order('created_at', { ascending: false }),
      supabase
        .from('shifts')
        .select('*, profile:profiles!shifts_user_id_fkey(*, department:departments(*))')
        .order('start_time', { ascending: true }),
      supabase.from('reminders').select('*').order('due_date', { ascending: true }),
      supabase.from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(*)').order('due_date', { ascending: true }),
      supabase
        .from('expenses')
        .select('*, profile:profiles!expenses_user_id_fkey(*)')
        .order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }),
      supabase.from('profile_fields').select('*').order('sort_order', { ascending: true }),
      supabase.from('allowed_locations').select('*').order('name'),
      supabase.from('employee_locations').select('*, employee:profiles(*)').order('created_at', { ascending: false }),
    ]);

    const profiles = ((p.data as Profile[]) ?? []).filter((row) => !row.hidden);
    setProfiles(profiles);
    setDepartments((d.data as Department[]) ?? []);
    setAttendance(((a.data as Attendance[]) ?? []).filter((row) => !row.profile?.hidden));
    setRequests(((r.data as EmployeeRequest[]) ?? []).filter((row) => !row.profile?.hidden));
    setShifts(((s.data as Shift[]) ?? []).filter((row) => !row.profile?.hidden));
    setReminders((rem.data as Reminder[]) ?? []);
    setTasks((t.data as Task[]) ?? []);
    setExpenses(((e.data as Expense[]) ?? []).filter((row) => !row.profile?.hidden));
    setNotifications((n.data as AppNotification[]) ?? []);
    setProfileFields((pf.data as ProfileField[]) ?? []);
    setAllowedLocations((al.data as AllowedLocation[]) ?? []);
    setEmployeeLocations(((el.data as EmployeeLocation[]) ?? []).filter((row) => !row.employee?.hidden));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    profiles,
    departments,
    attendance,
    requests,
    shifts,
    reminders,
    tasks,
    expenses,
    notifications,
    profileFields,
    allowedLocations,
    employeeLocations,
    loading,
    reload: loadAll,
  };
}
