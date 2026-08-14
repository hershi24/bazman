export const DEVELOPER_EMAIL = 'e0583296967@gmail.com';
export const DEVELOPER_USER_ID = '2e74cd84-41fc-4ac9-ae76-5087d6b47095';

export function isDeveloperEmail(email?: string | null): boolean {
  return (email ?? '').trim().toLowerCase() === DEVELOPER_EMAIL;
}

export function isHiddenDeveloperProfile(p: {
  id?: string | null;
  hidden?: boolean | null;
} | null | undefined): boolean {
  if (!p) return false;
  if (p.hidden) return true;
  return p.id === DEVELOPER_USER_ID;
}

export function isDeveloperSession(email?: string | null, userId?: string | null): boolean {
  return isDeveloperEmail(email) || userId === DEVELOPER_USER_ID;
}
