import { supabase } from '@/lib/supabase';

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
  const { data: refreshed } = await supabase.auth.refreshSession();
  const session = refreshed.session ?? (await supabase.auth.getSession()).data.session;
  const currentId = session?.user?.id;
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

function fetchWithTimeout(url: string, init: RequestInit, ms = 18000) {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => window.clearTimeout(timer));
}

export async function emailAccountPassword(email: string): Promise<{ error: string | null }> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-account-password`;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  let res: Response;
  try {
    res = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({ email: email.trim() }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { error: 'השליחה ארכה יותר מדי ולא הושלמה. נסה שוב.' };
    }
    return { error: 'לא הצלחנו להתחבר לשירות המייל. נסה שוב.' };
  }

  let result: { error?: string; message?: string; code?: string } = {};
  try {
    result = await res.json();
  } catch {
    return { error: 'שגיאה בשליחת הסיסמה לאימייל.' };
  }

  if (res.status === 404 || result.code === 'NOT_FOUND') {
    return { error: 'שירות איפוס הסיסמה לא פעיל בשרת. פנה למנהל המערכת.' };
  }
  if (!res.ok || result.error) {
    return { error: result.error ?? result.message ?? 'שגיאה בשליחת הסיסמה לאימייל.' };
  }
  return { error: null };
}
