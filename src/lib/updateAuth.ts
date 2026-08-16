import { supabase } from '@/lib/supabase';
import { isDeveloperEmail, isDeveloperSession } from '@/lib/developerAccount';

export type AuthUpdateResult = {
  error: string | null;
  applied: boolean;
};

function functionError(result: { error?: string; message?: string; msg?: string }) {
  return result.error || result.message || result.msg || '';
}

export async function updateUserAuth(payload: {
  userId: string;
  email?: string;
  password?: string;
}): Promise<AuthUpdateResult> {
  if (isDeveloperSession(payload.email, payload.userId) || isDeveloperEmail(payload.email)) {
    return { error: 'לא ניתן לשנות את חשבון המפתחים.', applied: false };
  }

  const { data: refreshed } = await supabase.auth.refreshSession();
  const session = refreshed.session ?? (await supabase.auth.getSession()).data.session;
  const currentEmail = session?.user?.email;
  const currentId = session?.user?.id;
  if (isDeveloperSession(currentEmail, currentId) && payload.userId === currentId) {
    return { error: 'לא ניתן לשנות את חשבון המפתחים.', applied: false };
  }
  if (!session?.access_token || !currentId) {
    return { error: 'יש להתחבר מחדש ואז לנסות שוב.', applied: false };
  }

  const isSelf = payload.userId === currentId;
  if (isSelf && payload.password && !payload.email) {
    const { error } = await supabase.auth.updateUser({ password: payload.password });
    if (error) return { error: error.message, applied: false };
    return { error: null, applied: true };
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-employee-auth`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(payload),
  });

  let result: { error?: string; message?: string; msg?: string; applied?: boolean; email?: string } = {};
  try {
    result = await res.json();
  } catch {
    return { error: 'שגיאה בעדכון האימייל/סיסמה.', applied: false };
  }

  const err = functionError(result);
  if (!res.ok || err) {
    if (isSelf && payload.password && /unauthor|invalid jwt|401/i.test(err || String(res.status))) {
      const { error } = await supabase.auth.updateUser({ password: payload.password });
      if (!error) return { error: null, applied: true };
    }
    return { error: err || 'שגיאה בעדכון האימייל/סיסמה.', applied: false };
  }

  return { error: null, applied: result.applied !== false };
}

export async function emailAccountPassword(email: string): Promise<{ error: string | null }> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-account-password`;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({ email: email.trim() }),
  });
  let result: { error?: string } = {};
  try {
    result = await res.json();
  } catch {
    return { error: 'שגיאה בשליחת הסיסמה לאימייל.' };
  }
  if (!res.ok || result.error) {
    return { error: result.error ?? 'שגיאה בשליחת הסיסמה לאימייל.' };
  }
  return { error: null };
}
