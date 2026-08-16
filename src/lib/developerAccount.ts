export const DEVELOPER_EMAIL = 'e0583296967@gmail.com';
export const DEVELOPER_USER_ID = '2e74cd84-41fc-4ac9-ae76-5087d6b47095';

/** No email is locked anymore — the old developer account can be a normal manager. */
export function isDeveloperEmail(_email?: string | null): boolean {
  return false;
}

export function isHiddenDeveloperProfile(p: {
  id?: string | null;
  hidden?: boolean | null;
} | null | undefined): boolean {
  return Boolean(p?.hidden);
}

export function isDeveloperSession(_email?: string | null, _userId?: string | null): boolean {
  return false;
}
