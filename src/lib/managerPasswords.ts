import { supabase } from '@/lib/supabase';

const PASSWORD_KEY = 'bezman-manager-passwords';
const EMAIL_KEY = 'bezman-manager-emails';

function loadMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveMap(key: string, id: string, value: string) {
  const next = { ...loadMap(key), [id]: value };
  localStorage.setItem(key, JSON.stringify(next));
}

export function loadManagerPasswords(): Record<string, string> {
  return loadMap(PASSWORD_KEY);
}

export function loadManagerEmails(): Record<string, string> {
  return loadMap(EMAIL_KEY);
}

export function rememberManagerPassword(id: string, password: string) {
  saveMap(PASSWORD_KEY, id, password);
}

export function rememberManagerEmail(id: string, email: string) {
  saveMap(EMAIL_KEY, id, email.trim().toLowerCase());
}

export async function saveManagerLoginPassword(id: string, password: string) {
  rememberManagerPassword(id, password);
  const { error } = await supabase.from('profiles').update({ login_password: password }).eq('id', id);
  if (error && !/login_password|schema cache|column/i.test(error.message)) {
    return error.message;
  }
  return null;
}

export async function saveManagerLoginEmail(id: string, email: string) {
  const clean = email.trim().toLowerCase();
  rememberManagerEmail(id, clean);
  const { error } = await supabase.from('profiles').update({ login_email: clean }).eq('id', id);
  if (error && !/login_email|schema cache|column/i.test(error.message)) {
    return error.message;
  }
  return null;
}

