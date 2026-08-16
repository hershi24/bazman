import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { DEVELOPER_EMAIL } from '@/lib/developerAccount';
import { saveManagerLoginEmail, saveManagerLoginPassword } from '@/lib/managerPasswords';

export type StaffRole = 'manager' | 'employee';

export type CreateStaffPayload = {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  employee_number?: string | null;
  department_id?: string | null;
  role?: StaffRole;
};

function isolatedAuthClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const memory = new Map<string, string>();
  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key) => memory.get(key) ?? null,
        setItem: (key, value) => {
          memory.set(key, value);
        },
        removeItem: (key) => {
          memory.delete(key);
        },
      },
    },
  });
}

async function profileExists(id: string) {
  const { data } = await supabase.from('profiles').select('id, role').eq('id', id).maybeSingle();
  return data;
}

async function saveProfile(id: string, payload: CreateStaffPayload) {
  const role: StaffRole = payload.role === 'manager' ? 'manager' : 'employee';
  const row = {
    id,
    role,
    full_name: payload.full_name.trim(),
    employee_number: role === 'manager' ? null : payload.employee_number || null,
    department_id: role === 'manager' ? null : payload.department_id || null,
    phone: payload.phone || null,
    status: 'active' as const,
    hidden: false,
  };

  let { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error && /hidden/i.test(error.message)) {
    const { hidden: _hidden, ...withoutHidden } = row;
    error = (await supabase.from('profiles').upsert(withoutHidden, { onConflict: 'id' })).error;
  }
  if (error) return error.message;

  const found = await profileExists(id);
  if (!found) return 'המשתמש נוצר אבל לא נשמר בטבלת הפרופילים.';
  if (role === 'manager' && found.role !== 'manager') {
    const updated = await supabase.from('profiles').update({ role: 'manager' }).eq('id', id);
    if (updated.error) return updated.error.message;
  }
  return null;
}

async function createViaWebsiteSignup(payload: CreateStaffPayload): Promise<{ id?: string; error: string | null }> {
  const role: StaffRole = payload.role === 'manager' ? 'manager' : 'employee';
  const client = isolatedAuthClient();
  const { data, error } = await client.auth.signUp({
    email: payload.email.trim(),
    password: payload.password,
    options: {
      data: { full_name: payload.full_name.trim(), role },
    },
  });

  if (error) return { error: error.message };

  const userId = data.user?.id;
  if (!userId) return { error: 'לא הצלחנו ליצור את המשתמש באתר.' };
  if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
    return { error: 'האימייל כבר קיים במערכת.' };
  }

  const profileErr = await saveProfile(userId, payload);
  if (profileErr) return { error: profileErr };
  return { id: userId, error: null };
}

async function createViaFunction(payload: CreateStaffPayload): Promise<{ id?: string; error: string | null }> {
  const { data: refreshed } = await supabase.auth.refreshSession();
  const token =
    refreshed.session?.access_token ?? (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return { error: 'יש להתחבר מחדש ואז לנסות שוב.' };

  const { data, error } = await supabase.functions.invoke('create-employee', {
    body: payload,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) return { error: error.message };
  const id = (data as { id?: string; error?: string } | null)?.id;
  const fnError = (data as { error?: string } | null)?.error;
  if (fnError) return { error: fnError };
  if (!id) return { error: 'השרת לא יצר משתמש' };

  const profileErr = await saveProfile(id, payload);
  if (profileErr) return { error: profileErr };
  return { id, error: null };
}

async function createViaRpc(payload: CreateStaffPayload): Promise<{ id?: string; error: string | null }> {
  const role: StaffRole = payload.role === 'manager' ? 'manager' : 'employee';
  const { data, error } = await supabase.rpc('create_staff_user', {
    p_email: payload.email.trim(),
    p_password: payload.password,
    p_full_name: payload.full_name.trim(),
    p_role: role,
    p_phone: payload.phone || null,
    p_employee_number: payload.employee_number || null,
    p_department_id: payload.department_id || null,
  });
  if (error) return { error: error.message };
  const id = typeof data === 'string' ? data : String(data ?? '');
  if (!id) return { error: 'השרת לא החזיר מזהה משתמש' };
  const found = await profileExists(id);
  if (!found) return { error: 'המשתמש נוצר אבל הפרופיל לא נמצא.' };
  return { id, error: null };
}

export async function createStaffUser(
  payload: CreateStaffPayload,
): Promise<{ id?: string; error: string | null }> {
  const email = payload.email.trim().toLowerCase();
  if (email === DEVELOPER_EMAIL) {
    return { error: 'לא ניתן להשתמש באימייל של חשבון המפתחים.' };
  }
  if (!payload.full_name.trim() || !email || !payload.password) {
    return { error: 'נא למלא שם, אימייל וסיסמה.' };
  }
  if (payload.password.length < 6) {
    return { error: 'הסיסמה חייבת להכיל לפחות 6 תווים.' };
  }

  const body = { ...payload, email };

  const viaSite = await createViaWebsiteSignup(body);
  if (!viaSite.error) return finishCreate(viaSite, body);

  const signupBlocked = /signups? not allowed|signup is disabled|captcha/i.test(viaSite.error);
  if (!signupBlocked && !/already registered|already exists|already been registered/i.test(viaSite.error)) {
    const viaFn = await createViaFunction(body);
    if (!viaFn.error) return finishCreate(viaFn, body);
    const viaRpc = await createViaRpc(body);
    if (!viaRpc.error) return finishCreate(viaRpc, body);
    return { error: viaSite.error };
  }

  const viaFn = await createViaFunction(body);
  if (!viaFn.error) return finishCreate(viaFn, body);
  const viaRpc = await createViaRpc(body);
  if (!viaRpc.error) return finishCreate(viaRpc, body);

  return { error: viaSite.error };
}

async function finishCreate(
  result: { id?: string; error: string | null },
  payload: CreateStaffPayload,
) {
  if (result.id && payload.role === 'manager') {
    if (payload.password) await saveManagerLoginPassword(result.id, payload.password);
    if (payload.email) await saveManagerLoginEmail(result.id, payload.email);
  }
  return result;
}
