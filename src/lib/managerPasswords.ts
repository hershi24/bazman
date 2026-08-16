import { supabase } from '@/lib/supabase';

const KEY = 'bezman-manager-passwords';

export function loadManagerPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function rememberManagerPassword(id: string, password: string) {
  const next = { ...loadManagerPasswords(), [id]: password };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export async function saveManagerLoginPassword(id: string, password: string) {
  rememberManagerPassword(id, password);
  const { error } = await supabase.from('profiles').update({ login_password: password }).eq('id', id);
  if (error && !/login_password|schema cache|column/i.test(error.message)) {
    return error.message;
  }
  return null;
}
