export type Lang = 'he' | 'en';

export const LANG_STORAGE_KEY = 'bezman_employee_lang';

export function isLang(value: unknown): value is Lang {
  return value === 'he' || value === 'en';
}

export function readStoredLang(userId?: string | null): Lang {
  try {
    if (userId) {
      const userVal = localStorage.getItem(`${LANG_STORAGE_KEY}:${userId}`);
      if (isLang(userVal)) return userVal;
    }
    const global = localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(global)) return global;
  } catch {
    /* ignore */
  }
  return 'he';
}

export function persistLang(lang: Lang, userId?: string | null): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    if (userId) localStorage.setItem(`${LANG_STORAGE_KEY}:${userId}`, lang);
  } catch {
    /* ignore */
  }
}

export function applyDocumentLang(lang: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang === 'en' ? 'en' : 'he';
  document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = lang === 'en' ? 'BeZman — Time & Attendance' : 'BeZman — פתרונות נוכחות לעסקים';
}

export const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DAY_NAMES_LONG_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_SHORT_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const he = {
  brandTagline: 'פתרונות נוכחות לעסקים · גליצקי פתרונות טכנולוגיים',
  signOut: 'התנתק',
  tabClock: 'דיווח נוכחות',
  tabRequest: 'הגשת בקשה',
  tabHistory: 'היסטוריית דיווחים',
  tabFeedback: 'הצעות למפתח',
  tabAccount: 'החשבון שלי',
  developedBy: 'פותח על ידי',
  developedByName: 'גליצקי פתרונות טכנולוגיים לעסקים',
  cameraDenied: 'לא ניתן לפתוח את המצלמה. ודא שהדפדפן מורשה להשתמש במצלמה, ושהאתר נפתח ב-HTTPS.',
  qrNotApproved: 'קוד ה-QR שנסרק אינו מאושר לעובד זה, או שאינו קוד מקום עבודה תקין.',
  noLocations: 'אין מקומות מותרים מוגדרים עבורך. פנה למנהל.',
  noGeo: 'המכשיר אינו תומך באיתור מיקום.',
  needHttps: 'דפדפן דורש חיבור מאובטח (HTTPS) לגישה למיקום. יש לפתוח את האתר דרך כתובת מאובטחת.',
  outOfArea: 'המיקום אינו באזור מותר. יש להיות בתוך אזור העבודה לדיווח.',
  gpsError: 'שגיאה באיתור המיקום.',
  gpsDenied: 'גישה למיקום נדחתה. יש לאפשר גישה למיקום בהגדרות הדפדפן ובהגדרות המכשיר כדי לדווח.',
  gpsUnavailable: 'לא ניתן לאתר את המיקום. יש לוודא ש-GPS מופעל ויש קליטה, ולנסות שוב.',
  gpsTimeout: 'איתור המיקום ארך זמן רב מדי. יש לנסות שוב באזור פתוח.',
  clockFailed: 'הדיווח נכשל. נסה שוב.',
  clockInOk: 'הכניסה נרשמה בהצלחה!',
  noOpenShift: 'אין משמרת פתוחה ליציאה.',
  clockOutFailed: 'עדכון היציאה נכשל.',
  clockOutOk: 'היציאה נרשמה בהצלחה! אפשר לדווח כניסה נוספת מאוחר יותר.',
  today: 'היום, {date}',
  statusOnShift: 'נוכח כעת',
  statusOffShift: 'מחוץ למשמרת · אפשר לדווח שוב',
  statusNotIn: 'טרם דיווחת הגעה',
  workTimeNow: 'זמן עבודה כעת',
  currentClockIn: 'כניסה נוכחית',
  lastClockIn: 'כניסה אחרונה',
  clockOut: 'יציאה',
  clockIn: 'כניסה',
  totalToday: 'סה"כ היום',
  hoursUnit: 'שעות',
  reportProcess: 'תהליך הדיווח',
  gpsVerify: 'אימות מיקום GPS',
  locating: 'מאתר מיקום...',
  inAllowedArea: 'באזור מותר: {name}',
  locationVerified: 'מיקום אומת',
  locationDenied: 'גישה למיקום נדחתה',
  outsideArea: 'מחוץ לאזור מותר',
  deviceWillLocate: 'המכשיר יאתר את המיקום אוטומטית',
  qrScan: 'סריקת קוד QR',
  aimCamera: 'מכוון את המצלמה אל הקוד...',
  qrVerified: 'הקוד אומת בהצלחה',
  qrNotApprovedShort: 'קוד QR אינו מאושר לעובד זה',
  scanWorkplaceQr: 'סרוק את הקוד המוצב באזור העבודה',
  close: 'סגירה',
  cancel: 'ביטול',
  clockOutQr: 'יציאה ב-QR',
  clockInQr: 'כניסה ב-QR',
  scanCode: 'סרוק קוד',
  clockOutGps: 'יציאה במיקום',
  clockInGps: 'כניסה במיקום',
  gpsVerifyShort: 'אימות GPS',
  todayReports: 'דיווחים היום',
  shiftN: 'משמרת {n}',
  open: 'פתוחה',
  active: 'פעילה',
  completed: 'הושלמה',
  pending: 'ממתין',
  approved: 'אושר',
  rejected: 'נדחה',
  changed: 'שונה',
  aimAtCode: 'מכוון את המצלמה אל הקוד',
  locatingCode: 'מאתר קוד... הסריקה תאושר אוטומטית',
  prevMonth: 'חודש קודם',
  nextMonth: 'חודש הבא',
  workDay: 'יום עבודה',
  workDaysThisMonth: ' · {count} החודש',
  selectedDate: 'נבחר: {date}',
  pickDateToFix: 'בחרו תאריך לתיקון',
  needDate: 'נא לבחור את התאריך שצריך להתאים.',
  needShiftPick: 'יש כמה משמרות ביום הזה. נא לבחור איזו משמרת לתקן.',
  needInOrOut: 'נא לבחור כניסה ו/או יציאה ולמלא שעה.',
  outAfterIn: 'שעת היציאה צריכה להיות אחרי שעת הכניסה.',
  requestFailed: 'שליחת הבקשה נכשלה.',
  requestSent: 'הבקשה נשלחה למנהל בהצלחה!',
  reqHours: 'התאמת שעות',
  reqVacation: 'חופשה',
  reqSick: 'מחלה',
  reqOvertime: 'שעות נוספות',
  submitRequestTitle: 'הגשת בקשה למנהל',
  requestType: 'סוג הבקשה',
  requestedDate: 'תאריך מבוקש',
  calendarHint: 'ימים שעבדת מסומנים בירוק עם נקודה — כך קל לבחור איזה תאריך לתקן.',
  shiftsTodayPick: 'ביום הזה יש {count} משמרות — באיזו לתקן?',
  noReportYet: 'אין דיווח ביום הזה עדיין. אפשר לבקש שעות, ואחרי האישור ייווצר דיווח.',
  whichTime: 'איזו שעה לתקן?',
  overnightHint: 'יציאה אחרי חצות — אחרי אישור, המשמרת תיסגר ביום למחרת (למשל 22:00–02:00).',
  afterApproveHint: 'אחרי שהמנהל יאשר, השעות בדיווח יתעדכנו אוטומטית. משמרת לילה (יציאה אחרי חצות) נתמכת.',
  noteOptional: 'הערה (לא חובה)',
  requestDescription: 'תיאור הבקשה',
  notePlaceholder: 'למשל: שכחתי לדווח יציאה...',
  descPlaceholder: 'פרט את הבקשה...',
  sendRequest: 'שלח בקשה',
  myRequests: 'הבקשות שלי',
  noRequests: 'אין בקשות עדיין',
  requested: 'מבוקש',
  beforeChange: 'לפני השינוי',
  managerReply: 'תגובת מנהל',
  historyTitle: 'היסטוריית דיווחים',
  workDaysLabel: 'ימי עבודה',
  totalHours: 'סה"כ שעות',
  dailyAvg: 'ממוצע יומי',
  changeRequests: 'בקשות שינוי',
  noReportsInMonth: 'אין דיווחים בחודש {month}',
  monthlyTotal: 'סה"כ חודשי',
  feedbackTooShort: 'נא לכתוב הודעה קצת יותר מפורטת (לפחות 8 תווים).',
  feedbackSent: 'ההודעה נשלחה למפתח המערכת. תודה!',
  feedbackTitle: 'הצעות והערות למפתח',
  feedbackIntro: 'כאן אפשר לשלוח הצעה, הערה או דיווח על תקלה ישירות למפתח המערכת.',
  feedbackKind: 'סוג הפנייה',
  feedbackMessage: 'ההודעה',
  feedbackPlaceholder: 'כתבו כאן את ההצעה או ההערה...',
  sending: 'שולח...',
  sendToDev: 'שלח למפתח',
  catSuggestion: 'הצעה',
  catComment: 'הערה',
  catIssue: 'תקלה',
  catOther: 'אחר',
  needEmail: 'נא להזין כתובת אימייל.',
  noLoggedUser: 'לא נמצא משתמש מחובר.',
  emailNotApplied: 'האימייל לא הוחל מיד. נסה שוב.',
  emailUpdated: 'האימייל עודכן מיד, בלי מייל אישור. התחבר מחדש עם האימייל החדש.',
  passwordMin: 'הסיסמה חייבת להכיל לפחות 6 תווים.',
  passwordUpdated: 'הסיסמה עודכנה בהצלחה!',
  updateEmailTitle: 'עדכון כתובת אימייל (שם משתמש)',
  emailImmediate: 'האימייל מתעדכן מיד, בלי מייל אישור ובלי קישור.',
  emailAddress: 'כתובת אימייל',
  updateEmail: 'עדכן אימייל',
  changePasswordTitle: 'החלפת סיסמה',
  newPassword: 'סיסמה חדשה',
  passwordPlaceholder: 'לפחות 6 תווים',
  updatePassword: 'עדכן סיסמה',
  signOutTitle: 'התנתקות',
  signOutAccount: 'התנתק מהחשבון',
  language: 'שפה',
  loginTagline: 'פתרונות נוכחות לעסקים',
  loginHeadline: 'נהלו נוכחות, משמרות ודיווחים — ',
  loginHeadlineAccent: 'בקלות ובדיוק',
  loginSub: 'מערכת ארגונית למעקב נוכחות עם אימות GPS וסריקת QR, ניהול משמרות, בקשות עובדים ודוחות בזמן אמת.',
  featGps: 'אימות GPS',
  featQr: 'סריקת QR',
  featAccuracy: 'דיוק מלא',
  copyright: '© 2026 BeZman — כל הזכויות שמורות',
  loginTitle: 'כניסה למערכת',
  loginSubtitle: 'הזן את פרטי החיבור',
  email: 'אימייל',
  password: 'סיסמה',
  wrongDetails: 'הפרטים שגויים. נסה שוב.',
  signingIn: 'מתחבר...',
  signIn: 'כניסה',
  forgotPassword: 'שכחת סיסמה?',
  resetTitle: 'איפוס סיסמה',
  resetSubtitle: 'נשלח לאימייל שלך קישור לבחירת סיסמה חדשה',
  resetSent: 'אם החשבון קיים, נשלח קישור לאימייל. בדוק גם בספאם.',
  resetFailed: 'שליחת המייל נכשלה. נסה שוב.',
  sendingLink: 'שולח...',
  sendResetLink: 'שלח קישור לאימייל',
  backToLogin: 'חזרה לכניסה',
  emailConfirmed: 'האימייל אושר. אפשר להתחבר עם הכתובת החדשה.',
  linkExpired: 'הקישור פג תוקף. אם ביקשת איפוס סיסמה, שלח קישור חדש.',
  resetPwPageTitle: 'איפוס סיסמה',
  passwordUpdatedTitle: 'הסיסמה עודכנה בהצלחה!',
  passwordUpdatedBody: 'כעת תוכל להתחבר למערכת עם הסיסמה החדשה.',
  chooseNewPassword: 'בחירת סיסמה חדשה',
  chooseNewPasswordHint: 'הזן את הסיסמה החדשה שלך לפחות 6 תווים',
  confirmPassword: 'אימות סיסמה',
  passwordsMismatch: 'הסיסמאות אינן תואמות.',
  updating: 'מעדכן...',
  requestLabel: 'בקשה',
  decision: 'החלטה',
  verified: 'מאומת',
  notVerified: 'לא מאומת',
  missingClockOut: 'יציאה חסרה',
  monthlyReportTitle: 'דוח נוכחות חודשי - {name} - {month}',
  producedOn: 'הופק בתאריך {date}',
  employee: 'עובד',
  employeeNumber: 'מספר עובד',
  period: 'תקופה',
  date: 'תאריך',
  day: 'יום',
  hours: 'שעות',
  verification: 'אימות',
  changeRequest: 'בקשת שינוי',
  employeeSignature: 'חתימת עובד',
  managerSignature: 'חתימת מנהל',
  reportFooter: 'מערכת ניהול נוכחות — BeZman',
  summary: 'סיכום',
  workDaysCount: '{count} ימי עבודה',
  csvFilename: 'דוח_נוכחות_{name}_{month}.csv',
  shift1: 'משמרת 1',
  inWord: 'כניסה',
  outWord: 'יציאה',
  shiftWord: 'משמרת',
} as const;

export type MsgKey = keyof typeof he;

const en: Record<MsgKey, string> = {
  brandTagline: 'Time & attendance for businesses · Glitzky Technology Solutions',
  signOut: 'Sign out',
  tabClock: 'Clock in / out',
  tabRequest: 'Submit a request',
  tabHistory: 'Attendance history',
  tabFeedback: 'Message the developer',
  tabAccount: 'My account',
  developedBy: 'Built by',
  developedByName: 'Glitzky Technology Solutions',
  cameraDenied: 'The camera could not be opened. Allow camera access in the browser, and open the site over HTTPS.',
  qrNotApproved: 'This QR code is not approved for you, or it is not a valid workplace code.',
  noLocations: 'No allowed work locations are set for you. Please contact your manager.',
  noGeo: 'This device does not support location.',
  needHttps: 'The browser needs a secure (HTTPS) connection to use location. Please open the site with a secure address.',
  outOfArea: 'You are not in an allowed work area. Move into the work area to clock in or out.',
  gpsError: 'Could not find your location.',
  gpsDenied: 'Location access was denied. Allow location in the browser and on the device so you can clock in.',
  gpsUnavailable: 'Location is unavailable. Turn on GPS, check the signal, and try again.',
  gpsTimeout: 'Finding your location took too long. Try again somewhere more open.',
  clockFailed: 'Clock-in failed. Please try again.',
  clockInOk: 'You are clocked in.',
  noOpenShift: 'There is no open shift to clock out of.',
  clockOutFailed: 'Clock-out failed.',
  clockOutOk: 'You are clocked out. You can clock in again later.',
  today: 'Today, {date}',
  statusOnShift: 'Clocked in',
  statusOffShift: 'Off shift · you can clock in again',
  statusNotIn: 'You have not clocked in yet',
  workTimeNow: 'Time on this shift',
  currentClockIn: 'Current clock-in',
  lastClockIn: 'Last clock-in',
  clockOut: 'Clock out',
  clockIn: 'Clock in',
  totalToday: 'Total today',
  hoursUnit: 'hours',
  reportProcess: 'Clock-in steps',
  gpsVerify: 'GPS location check',
  locating: 'Finding your location...',
  inAllowedArea: 'In allowed area: {name}',
  locationVerified: 'Location verified',
  locationDenied: 'Location access denied',
  outsideArea: 'Outside the allowed area',
  deviceWillLocate: 'Your device will find your location automatically',
  qrScan: 'Scan QR code',
  aimCamera: 'Point the camera at the code...',
  qrVerified: 'Code verified',
  qrNotApprovedShort: 'This QR code is not approved for you',
  scanWorkplaceQr: 'Scan the code posted in the work area',
  close: 'Close',
  cancel: 'Cancel',
  clockOutQr: 'Clock out with QR',
  clockInQr: 'Clock in with QR',
  scanCode: 'Scan code',
  clockOutGps: 'Clock out with location',
  clockInGps: 'Clock in with location',
  gpsVerifyShort: 'GPS check',
  todayReports: 'Today’s records',
  shiftN: 'Shift {n}',
  open: 'Open',
  active: 'Active',
  completed: 'Completed',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Declined',
  changed: 'Changed',
  aimAtCode: 'Point the camera at the code',
  locatingCode: 'Looking for a code... it will confirm automatically',
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  workDay: 'Work day',
  workDaysThisMonth: ' · {count} this month',
  selectedDate: 'Selected: {date}',
  pickDateToFix: 'Choose the date to correct',
  needDate: 'Please choose the date you need to correct.',
  needShiftPick: 'There are several shifts on this day. Please choose which shift to correct.',
  needInOrOut: 'Choose clock-in and/or clock-out and enter a time.',
  outAfterIn: 'Clock-out must be after clock-in.',
  requestFailed: 'The request could not be sent.',
  requestSent: 'Your request was sent to the manager.',
  reqHours: 'Hours adjustment',
  reqVacation: 'Vacation',
  reqSick: 'Sick leave',
  reqOvertime: 'Overtime',
  submitRequestTitle: 'Send a request to your manager',
  requestType: 'Request type',
  requestedDate: 'Date this is for',
  calendarHint: 'Days you worked are marked in green with a dot — that makes it easy to pick the date to correct.',
  shiftsTodayPick: 'There are {count} shifts on this day — which one should we correct?',
  noReportYet: 'There is no record for this day yet. You can still request hours; a record will be created after approval.',
  whichTime: 'Which time should we correct?',
  overnightHint: 'Clock-out is after midnight — after approval, the shift will close on the next day (for example 22:00–02:00).',
  afterApproveHint: 'After the manager approves, the times on your record update automatically. Overnight shifts (clock-out after midnight) are supported.',
  noteOptional: 'Note (optional)',
  requestDescription: 'Request details',
  notePlaceholder: 'For example: I forgot to clock out...',
  descPlaceholder: 'Describe the request...',
  sendRequest: 'Send request',
  myRequests: 'My requests',
  noRequests: 'No requests yet',
  requested: 'Requested',
  beforeChange: 'Before the change',
  managerReply: 'Manager reply',
  historyTitle: 'Attendance history',
  workDaysLabel: 'Days worked',
  totalHours: 'Total hours',
  dailyAvg: 'Daily average',
  changeRequests: 'Change requests',
  noReportsInMonth: 'No records in {month}',
  monthlyTotal: 'Month total',
  feedbackTooShort: 'Please write a little more detail (at least 8 characters).',
  feedbackSent: 'Your message was sent to the system developer. Thank you!',
  feedbackTitle: 'Suggestions and notes for the developer',
  feedbackIntro: 'Use this page to send a suggestion, a comment, or a bug report straight to the system developer.',
  feedbackKind: 'Type of message',
  feedbackMessage: 'Your message',
  feedbackPlaceholder: 'Write your suggestion or comment here...',
  sending: 'Sending...',
  sendToDev: 'Send to developer',
  catSuggestion: 'Suggestion',
  catComment: 'Comment',
  catIssue: 'Issue',
  catOther: 'Other',
  needEmail: 'Please enter an email address.',
  noLoggedUser: 'No signed-in user was found.',
  emailNotApplied: 'The email was not updated right away. Please try again.',
  emailUpdated: 'Your email was updated immediately. Sign in again with the new email.',
  passwordMin: 'The password must be at least 6 characters.',
  passwordUpdated: 'Your password was updated.',
  updateEmailTitle: 'Update email (username)',
  emailImmediate: 'The email is updated immediately — no confirmation email and no link.',
  emailAddress: 'Email address',
  updateEmail: 'Update email',
  changePasswordTitle: 'Change password',
  newPassword: 'New password',
  passwordPlaceholder: 'At least 6 characters',
  updatePassword: 'Update password',
  signOutTitle: 'Sign out',
  signOutAccount: 'Sign out of this account',
  language: 'Language',
  loginTagline: 'Time & attendance for businesses',
  loginHeadline: 'Track attendance, shifts, and reports — ',
  loginHeadlineAccent: 'simply and accurately',
  loginSub: 'A workplace system for attendance with GPS checks and QR scanning, shift management, employee requests, and live reports.',
  featGps: 'GPS check',
  featQr: 'QR scan',
  featAccuracy: 'Accurate records',
  copyright: '© 2026 BeZman — All rights reserved',
  loginTitle: 'Sign in',
  loginSubtitle: 'Enter your login details',
  email: 'Email',
  password: 'Password',
  wrongDetails: 'Those details are not correct. Please try again.',
  signingIn: 'Signing in...',
  signIn: 'Sign in',
  forgotPassword: 'Forgot password?',
  resetTitle: 'Reset password',
  resetSubtitle: 'We will email you a link to choose a new password',
  resetSent: 'If an account exists, a link was sent to that email. Check spam too.',
  resetFailed: 'The email could not be sent. Please try again.',
  sendingLink: 'Sending...',
  sendResetLink: 'Send email link',
  backToLogin: 'Back to sign in',
  emailConfirmed: 'The email was confirmed. You can sign in with the new address.',
  linkExpired: 'This link has expired. If you asked to reset your password, send a new link.',
  resetPwPageTitle: 'Reset password',
  passwordUpdatedTitle: 'Your password was updated.',
  passwordUpdatedBody: 'You can now sign in with the new password.',
  chooseNewPassword: 'Choose a new password',
  chooseNewPasswordHint: 'Enter a new password of at least 6 characters',
  confirmPassword: 'Confirm password',
  passwordsMismatch: 'The passwords do not match.',
  updating: 'Updating...',
  requestLabel: 'Request',
  decision: 'Decision',
  verified: 'Verified',
  notVerified: 'Not verified',
  missingClockOut: 'Missing clock-out',
  monthlyReportTitle: 'Monthly attendance report - {name} - {month}',
  producedOn: 'Created on {date}',
  employee: 'Employee',
  employeeNumber: 'Employee number',
  period: 'Period',
  date: 'Date',
  day: 'Day',
  hours: 'Hours',
  verification: 'Verification',
  changeRequest: 'Change request',
  employeeSignature: 'Employee signature',
  managerSignature: 'Manager signature',
  reportFooter: 'Attendance system — BeZman',
  summary: 'Summary',
  workDaysCount: '{count} days worked',
  csvFilename: 'attendance_report_{name}_{month}.csv',
  shift1: 'Shift 1',
  inWord: 'In',
  outWord: 'Out',
  shiftWord: 'Shift',
};

export const messages: Record<Lang, Record<MsgKey, string>> = { he, en };

export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] == null ? `{${key}}` : String(vars[key]),
  );
}

export function translate(lang: Lang, key: MsgKey, vars?: Record<string, string | number>): string {
  return interpolate(messages[lang][key] ?? messages.he[key], vars);
}

export type TranslateFn = (key: MsgKey, vars?: Record<string, string | number>) => string;

const HEBREW_ERROR_TO_KEY: Record<string, MsgKey> = {
  'יש להתחבר מחדש ואז לנסות שוב.': 'noLoggedUser',
  'שגיאה בעדכון האימייל/סיסמה.': 'emailNotApplied',
  'נא לכתוב הודעה קצת יותר מפורטת (לפחות 8 תווים).': 'feedbackTooShort',
  'לא ניתן לשלוח כרגע. נסו שוב בעוד כמה דקות.': 'resetFailed',
  'נא להזין כתובת אימייל.': 'needEmail',
  'השליחה ארכה יותר מדי ולא הושלמה. נסה שוב.': 'resetFailed',
  'נשלחו יותר מדי מיילים. נסה שוב בעוד כמה דקות.': 'resetFailed',
};

export function localizeError(message: string, t: TranslateFn, lang: Lang): string {
  if (lang === 'he') return message;
  const key = HEBREW_ERROR_TO_KEY[message];
  if (key) return t(key);
  if (message.includes('כתובת האתר לא מורשית')) {
    return 'This site address is not allowed in Supabase. Ask an admin to add it under Authentication → URL Configuration → Redirect URLs.';
  }
  return message;
}

export const REQUEST_TYPES = [
  { value: 'התאמת שעות', key: 'reqHours' as const },
  { value: 'חופשה', key: 'reqVacation' as const },
  { value: 'מחלה', key: 'reqSick' as const },
  { value: 'שעות נוספות', key: 'reqOvertime' as const },
];

export function requestTypeLabel(type: string, t: TranslateFn, lang: Lang): string {
  if (lang === 'he') return type;
  const found = REQUEST_TYPES.find((item) => item.value === type);
  if (found) return t(found.key);
  if (type.trim() === 'הצעה למפתח') return t('tabFeedback');
  return type;
}

export const FEEDBACK_CATEGORY_KEYS = [
  { value: 'הצעה', key: 'catSuggestion' as const },
  { value: 'הערה', key: 'catComment' as const },
  { value: 'תקלה', key: 'catIssue' as const },
  { value: 'אחר', key: 'catOther' as const },
] as const;

export function statusLabel(status: string, t: TranslateFn): string {
  if (status === 'approved') return t('approved');
  if (status === 'rejected') return t('rejected');
  if (status === 'changed') return t('changed');
  return t('pending');
}

export function dateLocale(lang: Lang): string {
  return lang === 'en' ? 'en-GB' : 'he-IL';
}
