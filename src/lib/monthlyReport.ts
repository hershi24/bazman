import type { Attendance, EmployeeRequest, Profile } from '@/types';
import { formatHebrewDate, formatTime } from '@/lib/format';
import { hoursAdjustmentSummary, originalHoursSummary, parseHoursAdjustment, effectiveRequestDecision, israelDateKey, isHoursAdjustmentType, shiftLabel } from '@/lib/hoursAdjustment';
import { isMissingClockOut, openShiftLabel } from '@/lib/attendanceDay';
import { averageMinutes, formatHm, formatHmHtml, minutesBetween, minutesBetweenOrZero } from '@/lib/workDuration';
import { DAY_NAMES_LONG_EN, MONTH_NAMES_EN, requestTypeLabel, translate, type Lang } from '@/lib/i18n';

export const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export const DAY_NAMES_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string, lang: Lang = 'he'): string {
  const [y, m] = key.split('-');
  const names = lang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES;
  return `${names[parseInt(m) - 1]} ${y}`;
}

export function dayNameLong(dayIndex: number, lang: Lang = 'he'): string {
  return (lang === 'en' ? DAY_NAMES_LONG_EN : DAY_NAMES_LONG)[dayIndex] ?? '';
}

export function monthDateRange(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type MonthlySummary = {
  records: Attendance[];
  totalMinutes: number;
  daysWorked: number;
  approved: number;
  pending: number;
  rejected: number;
  missingClockOut: number;
  changeRequests: EmployeeRequest[];
};

export function localDateKey(value: string | null | undefined): string {
  return israelDateKey(value);
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

export function shiftMetaForAttendance(
  record: Attendance,
  records: Attendance[],
): { number: number; total: number } {
  const key = localDateKey(record.clock_in);
  const day = records
    .filter((r) => r.user_id === record.user_id && localDateKey(r.clock_in) === key)
    .sort((a, b) => new Date(a.clock_in ?? 0).getTime() - new Date(b.clock_in ?? 0).getTime());
  return {
    number: Math.max(1, day.findIndex((r) => r.id === record.id) + 1),
    total: day.length || 1,
  };
}

export function requestAppliesToAttendance(
  req: EmployeeRequest,
  record: Attendance,
  dayRecords: Attendance[],
): boolean {
  const meta = shiftMetaForAttendance(record, dayRecords);
  const adj = isHoursAdjustmentType(req.type) ? parseHoursAdjustment(req.description) : null;
  if (!adj) return meta.total <= 1 || meta.number === 1;
  if (adj.attendanceId) return adj.attendanceId === record.id;
  if (adj.shiftNumber) return adj.shiftNumber === meta.number;
  return meta.total <= 1 || meta.number === 1;
}

export function attendanceShiftCaption(record: Attendance, records: Attendance[], lang: Lang = 'he'): string {
  const meta = shiftMetaForAttendance(record, records);
  return shiftLabel(meta.number, meta.total, lang);
}

export function requestsForAttendanceRecord(
  record: Attendance,
  requests: EmployeeRequest[],
  dayRecords?: Attendance[],
): EmployeeRequest[] {
  const siblings = dayRecords ?? [record];
  return requestsForAttendanceDay(record.user_id, record.clock_in, requests).filter((req) =>
    requestAppliesToAttendance(req, record, siblings),
  );
}

export function changeRequestDecision(req: EmployeeRequest): 'pending' | 'approved' | 'rejected' | 'changed' {
  if (req.status === 'pending') return 'pending';
  if (req.status === 'rejected') return 'rejected';
  if (req.manager_note?.trim()) return 'changed';
  return 'approved';
}

function decisionWord(kind: string, lang: Lang): string {
  return translate(lang, kind === 'pending' ? 'pending' : kind === 'rejected' ? 'rejected' : kind === 'changed' ? 'changed' : 'approved');
}

export function changeRequestDecisionLabel(req: EmployeeRequest, lang: Lang = 'he'): string {
  return decisionWord(changeRequestDecision(req), lang);
}

export function formatChangeRequestPlain(req: EmployeeRequest, record?: Attendance | null, lang: Lang = 'he'): string {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  const typeLabel = requestTypeLabel(req.type, t, lang);
  const adj = parseHoursAdjustment(req.description);
  const asked = adj
    ? `${typeLabel}${adj.shiftNumber && adj.shiftNumber > 1 ? ` · ${shiftLabel(adj.shiftNumber, undefined, lang)}` : ''} — ${t('requested')}: ${hoursAdjustmentSummary(adj, lang)}`
    : req.description?.trim()
      ? `${typeLabel} — ${req.description.trim()}`
      : typeLabel;
  const before = adj ? originalHoursSummary(adj, lang) : '';
  const kind = effectiveRequestDecision(req, record);
  const decision = decisionWord(kind, lang);
  const note = req.manager_note?.trim();
  const parts = [`${t('requestLabel')}: ${asked}`];
  if (before) parts.push(`${t('beforeChange')}: ${before}`);
  parts.push(`${t('decision')}: ${decision}${note ? ` — ${note}` : ''}`);
  return parts.join('. ');
}

export function formatChangeRequestsPlain(
  reqs: EmployeeRequest[],
  record?: Attendance | null,
  lang: Lang = 'he',
): string {
  if (reqs.length === 0) return '';
  return reqs.map((req) => formatChangeRequestPlain(req, record, lang)).join(' | ');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatChangeRequestHtml(req: EmployeeRequest, record?: Attendance | null, lang: Lang = 'he'): string {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  const typeLabel = requestTypeLabel(req.type, t, lang);
  const adj = parseHoursAdjustment(req.description);
  const askedRaw = adj
    ? `${typeLabel}${adj.shiftNumber && adj.shiftNumber > 1 ? ` · ${shiftLabel(adj.shiftNumber, undefined, lang)}` : ''} — ${t('requested')}: ${hoursAdjustmentSummary(adj, lang)}`
    : req.description?.trim()
      ? `${typeLabel} — ${req.description.trim()}`
      : typeLabel;
  const asked = escapeHtml(askedRaw);
  const before = adj ? originalHoursSummary(adj, lang) : '';
  const kind = effectiveRequestDecision(req, record);
  const decision = decisionWord(kind, lang);
  const cls =
    kind === 'rejected' ? 'st-rejected' : kind === 'pending' ? 'st-pending' : kind === 'changed' ? 'st-changed' : 'st-approved';
  const note = req.manager_note?.trim();
  const decisionHtml = note ? `${escapeHtml(decision)} — ${escapeHtml(note)}` : escapeHtml(decision);
  const beforeHtml = before ? `<div>${escapeHtml(t('beforeChange'))}: ${escapeHtml(before)}</div>` : '';
  return `<div class="chg"><div>${escapeHtml(t('requestLabel'))}: ${asked}</div>${beforeHtml}<div>${escapeHtml(t('decision'))}: <span class="${cls}">${decisionHtml}</span></div></div>`;
}

export function computeMonthlySummary(records: Attendance[], requests: EmployeeRequest[] = []): MonthlySummary {
  const sorted = [...records].sort(
    (a, b) => new Date(a.clock_in!).getTime() - new Date(b.clock_in!).getTime(),
  );
  const userIds = new Set(sorted.map((r) => r.user_id));
  const changeRequests = requests.filter((r) => userIds.has(r.user_id) && localDateKey(r.requested_date));
  return {
    records: sorted,
    totalMinutes: sorted.reduce((sum, r) => sum + minutesBetweenOrZero(r.clock_in, r.clock_out), 0),
    daysWorked: sorted.length,
    approved: sorted.filter((r) => r.status === 'approved').length,
    pending: sorted.filter((r) => r.status === 'pending').length,
    rejected: sorted.filter((r) => r.status === 'rejected').length,
    missingClockOut: sorted.filter((r) => isMissingClockOut(r)).length,
    changeRequests,
  };
}

function buildReportRows(records: Attendance[], requests: EmployeeRequest[], lang: Lang = 'he'): string {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  return records
    .map((r) => {
      const d = new Date(r.clock_in!);
      const dow = d.getDay();
      const isWeekend = dow >= 5;
      const hours = r.clock_out ? formatHmHtml(minutesBetween(r.clock_in, r.clock_out)) : '—';
      const dayReqs = requestsForAttendanceRecord(r, requests, records);
      const shift = attendanceShiftCaption(r, records, lang);
      const changeCell = dayReqs.length > 0 ? dayReqs.map((req) => formatChangeRequestHtml(req, r, lang)).join('') : '';
      return `<tr class="${isWeekend ? 'weekend' : ''}">
        <td class="date">${formatHebrewDate(r.clock_in, lang)}${shift ? `<div class="shift">${shift}</div>` : ''}</td>
        <td class="${isWeekend ? 'weekend-day' : ''}">${dayNameLong(dow, lang)}</td>
        <td class="in">${formatTime(r.clock_in)}</td>
        <td class="out">${formatTime(r.clock_out) || `<span class="missing">${openShiftLabel(r, undefined, lang)}</span>`}</td>
        <td class="hours">${hours}</td>
        <td>${r.location_verified || r.qr_verified ? t('verified') : t('notVerified')}</td>
        <td class="change">${changeCell}</td>
      </tr>`;
    })
    .join('');
}

export function generateEmployeeMonthlyReportHtml(
  profile: Profile,
  selectedMonth: string,
  summary: MonthlySummary,
  lang: Lang = 'he',
): string {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  const title = t('monthlyReportTitle', { name: profile.full_name, month: monthLabel(selectedMonth, lang) });
  const rows = buildReportRows(summary.records, summary.changeRequests, lang);
  const avgHours = formatHm(averageMinutes(summary.totalMinutes, summary.daysWorked));
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const htmlLang = lang === 'en' ? 'en' : 'he';
  const align = lang === 'en' ? 'left' : 'right';
  const hoursWord = t('hoursUnit');
  const brandLine = lang === 'en' ? 'BeZman · Glitzky Technology Solutions' : 'BeZman · גליצקי פתרונות טכנולוגיים';

  return `<!DOCTYPE html><html dir="${dir}" lang="${htmlLang}"><head><meta charset="utf-8"><title>${title}</title>
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
      th { background: #f1f5f9; padding: 8px 10px; text-align: ${align}; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
      td { padding: 7px 10px; text-align: ${align}; border-bottom: 1px solid #f1f5f9; }
      td.hours { font-weight: 700; color: #0f766e; }
      tfoot td { border-top: 2px solid #cbd5e1; font-weight: 700; background: #f8fafc; }
      tr.weekend { background: #fffbeb; }
      td.date { font-weight: 700; }
      .shift { margin-top: 2px; font-size: 10px; font-weight: 800; color: #4f46e5; }
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
        <p>${brandLine}</p>
        <p>${t('producedOn', { date: formatHebrewDate(new Date(), lang) })}</p>
      </div>
      <div class="meta-row">
        <span>${t('employee')}: ${profile.full_name}</span>
        ${profile.employee_number ? `<span>${t('employeeNumber')}: ${profile.employee_number}</span>` : ''}
        <span>${t('period')}: ${monthLabel(selectedMonth, lang)}</span>
      </div>
      <div class="summary-box">
        <div class="summary-item"><div class="val">${summary.daysWorked}</div><div class="lbl">${t('workDaysLabel')}</div></div>
        <div class="summary-item"><div class="val">${formatHmHtml(summary.totalMinutes)}</div><div class="lbl">${t('totalHours')}</div></div>
        <div class="summary-item"><div class="val">${avgHours === '—' ? '—' : `<span dir="ltr">${avgHours}</span>`}</div><div class="lbl">${t('dailyAvg')}</div></div>
        ${summary.changeRequests.length > 0 ? `<div class="summary-item"><div class="val">${summary.changeRequests.length}</div><div class="lbl">${t('changeRequests')}</div></div>` : ''}
        ${summary.missingClockOut > 0 ? `<div class="summary-item"><div class="val" style="color:#e11d48">${summary.missingClockOut}</div><div class="lbl">${t('missingClockOut')}</div></div>` : ''}
      </div>
      <table>
        <thead><tr><th>${t('date')}</th><th>${t('day')}</th><th>${t('clockIn')}</th><th>${t('clockOut')}</th><th>${t('hours')}</th><th>${t('verification')}</th><th>${t('changeRequest')}</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4">${t('monthlyTotal')}</td><td>${formatHmHtml(summary.totalMinutes)} ${hoursWord}</td><td colspan="2"></td></tr></tfoot>
      </table>
      <div class="sign-area">
        <div class="sign-box"><div class="line"></div><div class="label">${t('employeeSignature')}</div></div>
        <div class="sign-box"><div class="line"></div><div class="label">${t('managerSignature')}</div></div>
      </div>
      <div class="footer">${t('reportFooter')}</div>
    </body></html>`;
}

export function printMonthlyReport(profile: Profile, selectedMonth: string, summary: MonthlySummary, lang: Lang = 'he'): void {
  const html = generateEmployeeMonthlyReportHtml(profile, selectedMonth, summary, lang);
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
  lang: Lang = 'he',
): void {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  const header = [t('date'), t('shiftWord'), t('day'), t('clockIn'), t('clockOut'), t('hours'), t('verification'), t('changeRequest')];
  const rows = summary.records.map((r) => {
    const d = new Date(r.clock_in!);
    const hours = r.clock_out ? formatHm(minutesBetween(r.clock_in, r.clock_out)) : '';
    const dayReqs = requestsForAttendanceRecord(r, summary.changeRequests, summary.records);
    return [
      formatHebrewDate(r.clock_in, lang),
      attendanceShiftCaption(r, summary.records, lang) || t('shift1'),
      dayNameLong(d.getDay(), lang),
      formatTime(r.clock_in),
      r.clock_out ? formatTime(r.clock_out) : openShiftLabel(r, undefined, lang),
      hours,
      r.location_verified || r.qr_verified ? t('verified') : t('notVerified'),
      formatChangeRequestsPlain(dayReqs, r, lang),
    ].map(csvEscape);
  });

  rows.push([]);
  rows.push([
    t('summary'),
    '',
    '',
    '',
    formatHm(summary.totalMinutes),
    t('workDaysCount', { count: summary.daysWorked }),
    '',
  ].map(csvEscape));

  const bom = '\uFEFF';
  const csv = bom + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = profile.full_name.replace(/\s+/g, '_');
  a.href = url;
  a.download = t('csvFilename', { name: safeName, month: selectedMonth });
  a.click();
  URL.revokeObjectURL(url);
}
