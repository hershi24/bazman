import { supabase } from '@/lib/supabase';
import { isDeveloperEmail, isDeveloperSession } from '@/lib/developerAccount';

export type AuthUpdateResult = {
  error: string | null;
  applied: boolean;
};

export async function updateUserAuth(payload: {
  userId: string;
  email?: string;
  password?: string;
}): Promise<AuthUpdateResult> {
  if (isDeveloperSession(payload.email, payload.userId) || isDeveloperEmail(payload.email)) {
    return { error: 'לא ניתן לשנות את חשבון המפתחים.', applied: false };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const currentEmail = sessionData.session?.user?.email;
  const currentId = sessionData.session?.user?.id;
  if (isDeveloperSession(currentEmail, currentId) && payload.userId === currentId) {
    return { error: 'לא ניתן לשנות את חשבון המפתחים.', applied: false };
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-employee-auth`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(payload),
  });

  let result: { error?: string; applied?: boolean; email?: string } = {};
  try {
    result = await res.json();
  } catch {
    return { error: 'שגיאה בעדכון האימייל/סיסמה.', applied: false };
  }

  if (!res.ok || result.error) {
    return { error: result.error ?? 'שגיאה בעדכון האימייל/סיסמה.', applied: false };
  }

  return { error: null, applied: result.applied === true };
}

export async function sendWorkingEmailChangeLink(newEmail: string): Promise<{ error: string | null }> {
  const redirectTo = window.location.origin;
  const resend = await supabase.auth.resend({
    type: 'email_change',
    email: newEmail.trim(),
    options: { emailRedirectTo: redirectTo },
  });
  if (!resend.error) return { error: null };

  const { error } = await supabase.auth.updateUser(
    { email: newEmail.trim() },
    { emailRedirectTo: redirectTo },
  );
  if (error) return { error: error.message };
  return { error: null };
}
