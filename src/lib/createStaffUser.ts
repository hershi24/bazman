import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { DEVELOPER_EMAIL } from '@/lib/developerAccount';

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

function functionError(result: { error?: string; message?: string; msg?: string }) {
  return result.error || result.message || result.msg || '';
}

async function createViaFunction(payload: CreateStaffPayload): Promise<{ id?: string; error: string | null }> {
  const { data: refreshed } = await supabase.auth.refreshSession();
  const token = refreshed.session?.access_token;
  if (!token) {
    return { error: 'יש להתחבר מחדש ואז לנסות שוב.' };
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json().catch(() => ({} as { error?: string }));
  const err = functionError(result);
  if (!res.ok) {
    return { error: err || `שגיאה (${res.status})` };
  }
  return { id: result.id, error: null };
}

async function createViaSignUp(payload: CreateStaffPayload): Promise<{ id?: string; error: string | null }> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const isolated = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const role: StaffRole = payload.role === 'manager' ? 'manager' : 'employee';
  const { data, error } = await isolated.auth.signUp({
    email: payload.email.trim(),
    password: payload.password,
    options: {
      data: { full_name: payload.full_name, role },
      emailRedirectTo: undefined,
    },
  });

  if (error) {
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { error: 'לא הצלחנו ליצור את המשתמש.' };
  }
  if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
    return { error: 'האימייל כבר קיים במערכת.' };
  }

  const row = {
    id: userId,
    role,
    full_name: payload.full_name,
    employee_number: role === 'manager' ? null : payload.employee_number || null,
    department_id: role === 'manager' ? null : payload.department_id || null,
    phone: payload.phone || null,
    status: 'active' as const,
    hidden: false,
  };

  const inserted = await supabase.from('profiles').insert(row);
  if (inserted.error) {
    const updated = await supabase.from('profiles').update({
      role,
      full_name: payload.full_name,
      phone: payload.phone || null,
      hidden: false,
      status: 'active',
    }).eq('id', userId);
    if (updated.error) {
      return { id: userId, error: null };
    }
  }

  return { id: userId, error: null };
}

export async function createStaffUser(payload: CreateStaffPayload): Promise<{ id?: string; error: string | null }> {
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

  const viaFn = await createViaFunction({ ...payload, email });
  if (!viaFn.error) {
    return viaFn;
  }

  const unauthorized =
    /unauthor/i.test(viaFn.error) ||
    /invalid jwt/i.test(viaFn.error) ||
    viaFn.error.includes('401');

  if (!unauthorized) {
    return viaFn;
  }

  return createViaSignUp({ ...payload, email });
}
