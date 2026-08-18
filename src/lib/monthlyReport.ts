import type { Attendance, EmployeeRequest, Profile } from '@/types';
import { formatHebrewDate, formatTime } from '@/lib/format';
import { hoursAdjustmentSummary, parseHoursAdjustment } from '@/lib/hoursAdjustment';

export const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export const DAY_NAMES_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

export function parseHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return (e - s) / 3600000;
}

export function monthDateRange(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type MonthlySummary = {
  records: Attendance[];
  totalHours: number;
  daysWorked: number;
  approved: number;
  pending: number;
  rejected: number;
  missingClockOut: number;
  changeRequests: EmployeeRequest[];
};

export function localDateKey(value: string | null | undefined): string {
  if (!value) return '';
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function requestsForAttendanceDay(
  userId: string,
  clockIn: string | null,
  requests: EmployeeRequest[],
): EmployeeRequest[] {
  const key = localDateKey(clockIn);
  if (!key) return [];
  return requests.filter((r) => r.user_id === userId && localDateKey(r.requested_date) === key);
}

export function changeRequestDecision(req: EmployeeRequest): 'pending' | 'approved' | 'rejected' | 'changed' {
  if (req.status === 'pending') return 'pending';
  if (req.status === 'rejected') return 'rejected';
  if (req.manager_note?.trim()) return 'changed';
  return 'approved';
}

export function changeRequestDecisionLabel(req: EmployeeRequest): string {
  const d = changeRequestDecision(req);
  if (d === 'pending') return 'ממתין';
  if (d === 'rejected') return 'נדחה';
  if (d === 'changed') return 'שונה';
  return 'אושר';
}

export function formatChangeRequestPlain(req: EmployeeRequest): string {
  const adj = parseHoursAdjustment(req.description);
  const asked = adj
    ? `${req.type} — ${hoursAdjustmentSummary(adj)}${adj.note ? ` (${adj.note})` : ''}`
    : req.description?.trim()
      ? `${req.type} — ${req.description.trim()}`
      : req.type;
  const decision = changeRequestDecisionLabel(req);
  const note = req.manager_note?.trim();
  if (note) return `בקשה: ${asked}. החלטה: ${decision} — ${note}`;
  return `בקשה: ${asked}. החלטה: ${decision}`;
}

export function formatChangeRequestsPlain(reqs: EmployeeRequest[]): string {
  if (reqs.length === 0) return '';
  return reqs.map(formatChangeRequestPlain).join(' | ');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatChangeRequestHtml(req: EmployeeRequest): string {
  const adj = parseHoursAdjustment(req.description);
  const askedRaw = adj
    ? `${req.type} — ${hoursAdjustmentSummary(adj)}${adj.note ? ` (${adj.note})` : ''}`
    : req.description?.trim()
      ? `${req.type} — ${req.description.trim()}`
      : req.type;
  const asked = escapeHtml(askedRaw);
  const decision = changeRequestDecisionLabel(req);
  const kind = changeRequestDecision(req);
  const cls =
    kind === 'rejected' ? 'st-rejected' : kind === 'pending' ? 'st-pending' : kind === 'changed' ? 'st-changed' : 'st-approved';
  const note = req.manager_note?.trim();
  const decisionHtml = note ? `${escapeHtml(decision)} — ${escapeHtml(note)}` : escapeHtml(decision);
  return `<div class="chg"><div>בקשה: ${asked}</div><div>החלטה: <span class="${cls}">${decisionHtml}</span></div></div>`;
}

export function computeMonthlySummary(records: Attendance[], requests: EmployeeRequest[] = []): MonthlySummary {
  const sorted = [...records].sort(
    (a, b) => new Date(a.clock_in!).getTime() - new Date(b.clock_in!).getTime(),
  );
  const userIds = new Set(sorted.map((r) => r.user_id));
  const changeRequests = requests.filter((r) => userIds.has(r.user_id) && localDateKey(r.requested_date));
  return {
    records: sorted,
    totalHours: sorted.reduce((sum, r) => sum + parseHours(r.clock_in, r.clock_out), 0),
    daysWorked: sorted.length,
    approved: sorted.filter((r) => r.status === 'approved').length,
    pending: sorted.filter((r) => r.status === 'pending').length,
    rejected: sorted.filter((r) => r.status === 'rejected').length,
    missingClockOut: sorted.filter((r) => !r.clock_out).length,
    changeRequests,
  };
}

function buildReportRows(records: Attendance[], requests: EmployeeRequest[]): string {
  return records
    .map((r) => {
      const d = new Date(r.clock_in!);
      const dow = d.getDay();
      const isWeekend = dow >= 5;
      const hours = r.clock_out ? parseHours(r.clock_in, r.clock_out).toFixed(1) : '—';
      const dayReqs = requestsForAttendanceDay(r.user_id, r.clock_in, requests);
      const changeCell = dayReqs.length > 0 ? dayReqs.map(formatChangeRequestHtml).join('') : '';
      return `<tr class="${isWeekend ? 'weekend' : ''}">
        <td class="date">${formatHebrewDate(r.clock_in)}</td>
        <td class="${isWeekend ? 'weekend-day' : ''}">${DAY_NAMES_LONG[dow]}</td>
        <td class="in">${formatTime(r.clock_in)}</td>
        <td class="out">${formatTime(r.clock_out) || '<span class="missing">יציאה חסרה</span>'}</td>
        <td class="hours">${hours}</td>
        <td>${r.location_verified || r.qr_verified ? 'מאומת' : 'לא מאומת'}</td>
        <td class="change">${changeCell}</td>
      </tr>`;
    })
    .join('');
}

export function generateEmployeeMonthlyReportHtml(
  profile: Profile,
  selectedMonth: string,
  summary: MonthlySummary,
): string {
  const title = `דוח נוכחות חודשי - ${profile.full_name} - ${monthLabel(selectedMonth)}`;
  const rows = buildReportRows(summary.records, summary.changeRequests);
  const avgHours = summary.daysWorked > 0 ? (summary.totalHours / summary.daysWorked).toFixed(1) : '—';

  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${title}</title>
    <style>
      @page { size: A4; margin: 16mm 12mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Heebo', 'Arial', sans-serif; color: #1e293b; line-height: 1.5; }
      .header { text-align: center; border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
      .header h1 { font-size: 22px; margin: 0 0 4px; color: #0f766e; }
      .header p { font-size: 13px; color: #64748b; margin: 2px 0; }
      .meta-row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #64748b; margin-bottom: 16px; }
      .summary-box { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
      .summary-item { flex: 1; min-width: 100px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; text-align: center; }
      .summary-item .val { font-size: 20px; font-weight: 800; color: #0f766e; }
      .summary-item .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
      th { background: #f1f5f9; padding: 8px 10px; text-align: right; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
      td { padding: 7px 10px; text-align: right; border-bottom: 1px solid #f1f5f9; }
      td.hours { font-weight: 700; color: #0f766e; }
      tfoot td { border-top: 2px solid #cbd5e1; font-weight: 700; background: #f8fafc; }
      tr.weekend { background: #fffbeb; }
      td.date { font-weight: 700; }
      td.weekend-day { color: #b45309; font-weight: 700; }
      td.in { color: #059669; font-weight: 600; }
      td.out { color: #be123c; font-weight: 600; }
      td.change { font-size: 11px; color: #475569; max-width: 220px; }
      .chg { margin-bottom: 4px; }
      .st-approved { color: #059669; font-weight: 700; }
      .st-rejected { color: #e11d48; font-weight: 700; }
      .st-pending { color: #d97706; font-weight: 700; }
      .st-changed { color: #0369a1; font-weight: 700; }
      .missing { color: #e11d48; font-weight: 700; }
      .sign-area { margin-top: 40px; display: flex; justify-content: space-between; }
      .sign-box { text-align: center; }
      .sign-box .line { width: 200px; border-bottom: 1.5px solid #475569; margin-bottom: 4px; height: 30px; }
      .sign-box .label { font-size: 12px; color: #64748b; }
      .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    </style></head><body>
      <div class="header">
        <h1>${title}</h1>
        <p>BeZman · גליצקי פתרונות טכנולוגיים</p>
        <p>הופק בתאריך ${formatHebrewDate(new Date())}</p>
      </div>
      <div class="meta-row">
        <span>עובד: ${profile.full_name}</span>
        ${profile.employee_number ? `<span>מספר עובד: ${profile.employee_number}</span>` : ''}
        <span>תקופה: ${monthLabel(selectedMonth)}</span>
      </div>
      <div class="summary-box">
        <div class="summary-item"><div class="val">${summary.daysWorked}</div><div class="lbl">ימי עבודה</div></div>
        <div class="summary-item"><div class="val">${summary.totalHours.toFixed(1)}</div><div class="lbl">סה"כ שעות</div></div>
        <div class="summary-item"><div class="val">${avgHours}</div><div class="lbl">ממוצע יומי</div></div>
        ${summary.changeRequests.length > 0 ? `<div class="summary-item"><div class="val">${summary.changeRequests.length}</div><div class="lbl">בקשות שינוי</div></div>` : ''}
        ${summary.missingClockOut > 0 ? `<div class="summary-item"><div class="val" style="color:#e11d48">${summary.missingClockOut}</div><div class="lbl">יציאות חסרות</div></div>` : ''}
      </div>
      <table>
        <thead><tr><th>תאריך</th><th>יום</th><th>כניסה</th><th>יציאה</th><th>שעות</th><th>אימות</th><th>בקשת שינוי</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4">סה"כ חודשי</td><td>${summary.totalHours.toFixed(1)} שעות</td><td colspan="2"></td></tr></tfoot>
      </table>
      <div class="sign-area">
        <div class="sign-box"><div class="line"></div><div class="label">חתימת עובד</div></div>
        <div class="sign-box"><div class="line"></div><div class="label">חתימת מנהל</div></div>
      </div>
      <div class="footer">מערכת ניהול נוכחות — BeZman</div>
    </body></html>`;
}

export function printMonthlyReport(profile: Profile, selectedMonth: string, summary: MonthlySummary): void {
  const html = generateEmployeeMonthlyReportHtml(profile, selectedMonth, summary);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function downloadMonthlyReportCsv(
  profile: Profile,
  selectedMonth: string,
  summary: MonthlySummary,
): void {
  const header = ['תאריך', 'יום', 'כניסה', 'יציאה', 'שעות', 'אימות', 'בקשת שינוי'];
  const rows = summary.records.map((r) => {
    const d = new Date(r.clock_in!);
    const hours = r.clock_out ? parseHours(r.clock_in, r.clock_out).toFixed(1) : '';
    const dayReqs = requestsForAttendanceDay(r.user_id, r.clock_in, summary.changeRequests);
    return [
      formatHebrewDate(r.clock_in),
      DAY_NAMES_LONG[d.getDay()],
      formatTime(r.clock_in),
      r.clock_out ? formatTime(r.clock_out) : 'יציאה חסרה',
      hours,
      r.location_verified || r.qr_verified ? 'מאומת' : 'לא מאומת',
      formatChangeRequestsPlain(dayReqs),
    ].map(csvEscape);
  });

  rows.push([]);
  rows.push([
    'סיכום',
    '',
    '',
    '',
    summary.totalHours.toFixed(1),
    `${summary.daysWorked} ימי עבודה`,
    '',
  ].map(csvEscape));

  const bom = '\uFEFF';
  const csv = bom + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = profile.full_name.replace(/\s+/g, '_');
  a.href = url;
  a.download = `דוח_נוכחות_${safeName}_${selectedMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
