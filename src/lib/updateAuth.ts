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

function fetchWithTimeout(url: string, init: RequestInit, ms = 5000) {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => window.clearTimeout(timer));
}

function smtpMailError(message: string) {
  if (/redirect|whitelist|not allowed|invalid.*url/i.test(message)) {
    return 'כתובת האתר לא מורשית ב-Supabase. Authentication → URL Configuration → Redirect URLs.';
  }
  if (/rate limit|too many/i.test(message)) {
    return 'נשלחו יותר מדי מיילים. נסה שוב בעוד כמה דקות.';
  }
  return message;
}

async function sendRecoveryViaSupabaseSmtp(email: string, redirectTo?: string) {
  const send = async () => {
    const options = redirectTo ? { redirectTo } : undefined;
    const first = await supabase.auth.resetPasswordForEmail(email, options);
    if (!first.error) return { error: null as string | null };
    if (redirectTo && /redirect|whitelist|not allowed|invalid.*url/i.test(first.error.message)) {
      const retry = await supabase.auth.resetPasswordForEmail(email);
      if (!retry.error) return { error: null as string | null };
      return { error: smtpMailError(retry.error.message) };
    }
    return { error: smtpMailError(first.error.message) };
  };

  let timer = 0;
  try {
    return await Promise.race([
      send(),
      new Promise<{ error: string }>((_, reject) => {
        timer = window.setTimeout(() => reject(new DOMException('Timeout', 'AbortError')), 15000);
      }),
    ]);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { error: 'השליחה ארכה יותר מדי ולא הושלמה. נסה שוב.' };
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function emailAccountPassword(
  email: string,
  redirectTo?: string,
): Promise<{ error: string | null }> {
  const addr = email.trim().toLowerCase();
  const dest = redirectTo || (typeof window !== 'undefined' ? window.location.origin : undefined);
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-account-password`;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  try {
    const res = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({ email: addr, redirectTo: dest }),
    });
    if (res.ok) {
      const result = (await res.json().catch(() => ({}))) as { error?: string };
      if (!result.error) return { error: null };
    }
  } catch {
    // Function may be unpublished; Auth SMTP still works below.
  }

  return sendRecoveryViaSupabaseSmtp(addr, dest);
}
