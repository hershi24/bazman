import { supabase } from '@/lib/supabase';

export async function updateUserAuth(payload: {
  userId: string;
  email?: string;
  password?: string;
}): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
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

  let result: { error?: string } = {};
  try {
    result = await res.json();
  } catch {
    return { error: 'שגיאה בעדכון האימייל/סיסמה.' };
  }

  if (!res.ok || result.error) {
    return { error: result.error ?? 'שגיאה בעדכון האימייל/סיסמה.' };
  }

  return { error: null };
}
