import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Printer,
  Users,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  LogIn,
  LogOut,
  List,
  Pencil,
  Save,
  X,
  Loader2,
} from 'lucide-react';
import { Card, Avatar, Badge } from '@/components/ui';
import { formatHebrewDate, formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Attendance, EmployeeRequest, Profile } from '@/types';
import { formatChangeRequestHtml, requestsForAttendanceDay, requestsForAttendanceRecord, attendanceShiftCaption } from '@/lib/monthlyReport';
import {
  effectiveRequestDecision,
  hoursAdjustmentSummary,
  originalHoursSummary,
  parseHoursAdjustment,
} from '@/lib/hoursAdjustment';

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(val: string): string {
  if (!val) return '';
  return new Date(val).toISOString();
}

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const DAY_NAMES_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_NAMES_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function parseHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return (e - s) / 3600000;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

type EmpSummary = {
  profile: Profile;
  records: Attendance[];
  totalHours: number;
  daysWorked: number;
  changeRequestCount: number;
  missingClockOut: number;
};

function ChangeRequestBlock({
  record,
  requests,
  dayRecords,
}: {
  record: Attendance;
  requests: EmployeeRequest[];
  dayRecords?: Attendance[];
}) {
  const items = requestsForAttendanceRecord(record, requests, dayRecords);
  if (items.length === 0) return null;
  return (
    <div className="max-w-xs space-y-1.5">
      {items.map((req) => {
        const adj = parseHoursAdjustment(req.description);
        const kind = effectiveRequestDecision(req, record);
        const decision =
          kind === 'pending' ? 'ממתין' : kind === 'rejected' ? 'נדחה' : kind === 'changed' ? 'שונה' : 'אושר';
        const color =
          kind === 'rejected'
            ? 'text-rose-600'
            : kind === 'pending'
              ? 'text-amber-600'
              : kind === 'changed'
                ? 'text-sky-700'
                : 'text-emerald-700';
        const before = adj ? originalHoursSummary(adj) : '';
        return (
          <div key={req.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] leading-snug text-slate-600">
            <p>
              <span className="font-bold text-slate-700">בקשה: </span>
              {req.type}
              {adj ? ` — מבוקש: ${hoursAdjustmentSummary(adj)}` : ''}
            </p>
            {before ? (
              <p>
                <span className="font-bold text-slate-700">לפני השינוי: </span>
                {before}
              </p>
            ) : null}
            <p>
              <span className="font-bold text-slate-700">החלטה: </span>
              <span className={`font-bold ${color}`}>{decision}</span>
              {req.manager_note?.trim() ? ` — ${req.manager_note.trim()}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

type ViewMode = 'calendar' | 'list';

export default function WorkHoursSummary({
  attendance,
  profiles,
  requests = [],
  onReload,
}: {
  attendance: Attendance[];
  profiles: Profile[];
  requests?: EmployeeRequest[];
  onReload: () => void;
}) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(now));
  const [selectedEmp, setSelectedEmp] = useState('all');
  const [view, setView] = useState<ViewMode>('list');

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    attendance.forEach((a) => {
      if (a.clock_in) set.add(monthKey(new Date(a.clock_in)));
    });
    set.add(monthKey(now));
    return Array.from(set).sort().reverse();
  }, [attendance, now]);

  const employees = useMemo(
    () => profiles.filter((p) => p.role === 'employee' && p.status === 'active'),
    [profiles],
  );

  const filtered = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return attendance.filter((a) => {
      if (!a.clock_in) return false;
      const d = new Date(a.clock_in);
      if (d.getFullYear() !== y || d.getMonth() + 1 !== m) return false;
      if (selectedEmp !== 'all' && a.user_id !== selectedEmp) return false;
      return true;
    });
  }, [attendance, selectedMonth, selectedEmp]);

  const summaries: EmpSummary[] = useMemo(() => {
    const byEmp = new Map<string, Attendance[]>();
    filtered.forEach((a) => {
      const arr = byEmp.get(a.user_id) ?? [];
      arr.push(a);
      byEmp.set(a.user_id, arr);
    });
    const result: EmpSummary[] = [];
    employees.forEach((p) => {
      const records = (byEmp.get(p.id) ?? []).sort(
        (a, b) => new Date(a.clock_in!).getTime() - new Date(b.clock_in!).getTime(),
      );
      if (records.length === 0) return;
      const totalHours = records.reduce((sum, r) => sum + parseHours(r.clock_in, r.clock_out), 0);
      result.push({
        profile: p,
        records,
        totalHours,
        daysWorked: records.length,
        changeRequestCount: records.filter((r) => requestsForAttendanceDay(r.user_id, r.clock_in, requests).length > 0).length,
        missingClockOut: records.filter((r) => !r.clock_out).length,
      });
    });
    return result.sort((a, b) => b.totalHours - a.totalHours);
  }, [filtered, employees, requests]);

  const grandTotalHours = summaries.reduce((s, e) => s + e.totalHours, 0);
  const grandTotalDays = summaries.reduce((s, e) => s + e.daysWorked, 0);

  function navigateMonth(dir: number) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    const mk = monthKey(d);
    if (availableMonths.includes(mk)) setSelectedMonth(mk);
  }

  function handlePrint() {
    const empName = selectedEmp !== 'all' ? employees.find((p) => p.id === selectedEmp)?.full_name : null;
    const title = empName
      ? `סיכום שעות עבודה - ${empName} - ${monthLabel(selectedMonth)}`
      : `סיכום שעות עבודה - ${monthLabel(selectedMonth)}`;

    let body = '';
    if (view === 'list') {
      body = summaries.map((s) => {
        const rows = s.records.map((r) => {
          const d = new Date(r.clock_in!);
          const dow = d.getDay();
          const isWeekend = dow >= 5;
          const hours = r.clock_out ? parseHours(r.clock_in, r.clock_out).toFixed(1) : '—';
          return `<tr class="${isWeekend ? 'weekend' : ''}">
            <td class="date">${formatHebrewDate(r.clock_in)}${attendanceShiftCaption(r, s.records) ? `<div style="font-size:10px;font-weight:800;color:#4f46e5">${attendanceShiftCaption(r, s.records)}</div>` : ''}</td>
            <td class="${isWeekend ? 'weekend-day' : ''}">${DAY_NAMES_LONG[dow]}</td>
            <td class="in">${formatTime(r.clock_in)}</td>
            <td class="out">${formatTime(r.clock_out) || '<span class=\"missing\">יציאה חסרה</span>'}</td>
            <td class="hours">${hours}</td>
            <td>${r.location_verified ? 'מאומת' : 'לא מאומת'}</td>
            <td class="change">${requestsForAttendanceRecord(r, requests, s.records).map((req) => formatChangeRequestHtml(req, r)).join('')}</td>
          </tr>`;
        }).join('');
        return `
        <div class="emp-block">
          <h3>${s.profile.full_name}</h3>
          <p class="emp-meta">ימי עבודה: ${s.daysWorked} · סה"כ שעות: ${s.totalHours.toFixed(1)}${s.changeRequestCount ? ` · בקשות שינוי: ${s.changeRequestCount}` : ''}</p>
          <table class="list-table">
            <thead><tr><th>תאריך</th><th>יום</th><th>כניסה</th><th>יציאה</th><th>שעות</th><th>מיקום</th><th>בקשת שינוי</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="3" class="name">סה"כ</td><td class="hours">${s.totalHours.toFixed(1)}</td><td colspan="3"></td></tr></tfoot>
          </table>
        </div>`;
      }).join('');
    } else {
      body = summaries.map((s) => {
        const [yy, mm] = selectedMonth.split('-').map(Number);
        const first = new Date(yy, mm - 1, 1);
        const dim = new Date(yy, mm, 0).getDate();
        const offset = first.getDay();
        const recByDay = new Map<number, typeof s.records>();
        s.records.forEach((r) => {
          if (!r.clock_in) return;
          const d = new Date(r.clock_in);
          if (d.getFullYear() === yy && d.getMonth() + 1 === mm) {
            const arr = recByDay.get(d.getDate()) ?? [];
            arr.push(r);
            recByDay.set(d.getDate(), arr);
          }
        });
        const dayHeaders = DAY_NAMES_SHORT.map((d, i) =>
          `<th class="${i >= 5 ? 'weekend' : ''}">${d}</th>`,
        ).join('');
        const allCells: string[] = [];
        for (let i = 0; i < offset; i++) allCells.push('<td class="empty"></td>');
        for (let day = 1; day <= dim; day++) {
          const dow = new Date(yy, mm - 1, day).getDay();
          const isWeekend = dow >= 5;
          const recs = recByDay.get(day) ?? [];
          let inner = `<div class="day-num ${isWeekend ? 'weekend' : ''}">${day}</div>`;
          if (recs.length > 0) {
            recs.forEach((r, i) => {
              if (recs.length > 1) inner += `<div class="cal-shift">משמרת ${i + 1}</div>`;
              inner += `<div class="cal-in">↓ ${formatTime(r.clock_in)}</div>`;
              inner += r.clock_out
                ? `<div class="cal-out">↑ ${formatTime(r.clock_out)}</div>`
                : `<div class="cal-missing">יציאה חסרה</div>`;
              if (r.clock_out)
                inner += `<div class="cal-hours">${parseHours(r.clock_in, r.clock_out).toFixed(1)}ש׳</div>`;
            });
          }
          allCells.push(`<td class="cal-cell ${isWeekend ? 'weekend' : ''} ${recs.length > 0 ? 'has-rec' : ''}">${inner}</td>`);
        }
        while (allCells.length % 7 !== 0) allCells.push('<td class="empty"></td>');
        const rows: string[] = [];
        for (let i = 0; i < allCells.length; i += 7)
          rows.push(`<tr>${allCells.slice(i, i + 7).join('')}</tr>`);
        return `
        <div class="emp-block">
          <h3>${s.profile.full_name}</h3>
          <p class="emp-meta">ימי עבודה: ${s.daysWorked} · סה"כ שעות: ${s.totalHours.toFixed(1)}${s.changeRequestCount ? ` · בקשות שינוי: ${s.changeRequestCount}` : ''}</p>
          <table class="cal-table">
            <thead><tr>${dayHeaders}</tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>`;
      }).join('');
    }

    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page { size: A4; margin: 16mm 12mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Heebo', 'Arial', sans-serif; color: #1e293b; line-height: 1.5; }
        .header { text-align: center; border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 22px; margin: 0 0 4px; color: #0f766e; }
        .header p { font-size: 13px; color: #64748b; margin: 2px 0; }
        .meta-row { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
        th { background: #f1f5f9; padding: 8px 10px; text-align: right; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
        td { padding: 7px 10px; text-align: right; border-bottom: 1px solid #f1f5f9; }
        td.name { font-weight: 700; }
        td.hours { font-weight: 700; color: #0f766e; }
        tfoot td { border-top: 2px solid #cbd5e1; font-weight: 700; background: #f8fafc; }
        .emp-block { margin-bottom: 24px; page-break-inside: avoid; }
        .emp-block h3 { font-size: 16px; color: #0f766e; margin: 0 0 4px; border-right: 4px solid #0f766e; padding-right: 8px; }
        .emp-meta { font-size: 12px; color: #64748b; margin: 0 0 8px; }
        .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
        .sign-area { margin-top: 40px; display: flex; justify-content: space-between; }
        .sign-box { text-align: center; }
        .sign-box .line { width: 200px; border-bottom: 1.5px solid #475569; margin-bottom: 4px; height: 30px; }
        .sign-box .label { font-size: 12px; color: #64748b; }
        .cal-table { table-layout: fixed; border-collapse: collapse; }
        .cal-table th { background: #f8fafc; padding: 4px; font-size: 11px; color: #94a3b8; text-align: center; border: 1px solid #e2e8f0; }
        .cal-table th.weekend { background: #fef3c7; color: #b45309; }
        .cal-table td { border: 1px solid #e2e8f0; vertical-align: top; padding: 3px; height: 48px; width: 14.2%; }
        .cal-table td.empty { background: #fafafa; }
        .cal-table td.weekend { background: #fffbeb; }
        .cal-table td.has-rec { background: #f0fdf4; }
        .cal-cell .day-num { font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 2px; }
        .cal-cell .day-num.weekend { color: #b45309; }
        .cal-in { font-size: 9px; color: #059669; line-height: 1.3; font-weight: 600; }
        .cal-out { font-size: 9px; color: #be123c; line-height: 1.3; font-weight: 600; }
        .cal-missing { font-size: 9px; color: #e11d48; font-weight: 700; }
        .cal-hours { font-size: 9px; color: #0f766e; font-weight: 700; }
        .cal-shift { font-size: 8px; color: #4f46e5; font-weight: 800; margin-top: 3px; }
        .cal-more { font-size: 8px; color: #94a3b8; }
        .list-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .list-table th { background: #f1f5f9; padding: 6px 8px; text-align: right; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
        .list-table td { padding: 6px 8px; text-align: right; border-bottom: 1px solid #f1f5f9; }
        .list-table tr.weekend { background: #fffbeb; }
        .list-table td.date { font-weight: 700; }
        .list-table td.weekend-day { color: #b45309; font-weight: 700; }
        .list-table td.in { color: #059669; font-weight: 600; }
        .list-table td.out { color: #be123c; font-weight: 600; }
        .list-table td.hours { font-weight: 700; color: #0f766e; }
        .list-table td.change { font-size: 11px; color: #475569; }
        .list-table .st-approved { color: #059669; font-weight: 700; }
        .list-table .st-rejected { color: #e11d48; font-weight: 700; }
        .list-table .st-pending { color: #d97706; font-weight: 700; }
        .list-table .st-changed { color: #0369a1; font-weight: 700; }
        .list-table .missing { color: #e11d48; font-weight: 700; }
        .list-table tfoot td { border-top: 2px solid #cbd5e1; font-weight: 700; background: #f8fafc; }
      </style></head><body>
        <div class="header">
          <h1>${title}</h1>
          <p>הופק בתאריך ${formatHebrewDate(new Date())}</p>
        </div>
        <div class="meta-row">
          <span>תקופה: ${monthLabel(selectedMonth)}</span>
          <span>עובד: ${empName ?? 'כל העובדים'}</span>
          <span>סה"כ עובדים: ${summaries.length}</span>
        </div>
        ${body}
        <div class="sign-area">
          <div class="sign-box"><div class="line"></div><div class="label">חתימת מנהל</div></div>
          <div class="sign-box"><div class="line"></div><div class="label">חתימת עובד</div></div>
        </div>
        <div class="footer">מערכת ניהול שעות — BeZman</div>
      </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch { /* ignore */ }
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <Card>
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="min-w-[140px] text-center">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-500"
              >
                {availableMonths.map((mk) => (
                  <option key={mk} value={mk}>{monthLabel(mk)}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => navigateMonth(1)}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Employee filter */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            <select
              value={selectedEmp}
              onChange={(e) => setSelectedEmp(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-500"
            >
              <option value="all">כל העובדים</option>
              {employees.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                  view === 'calendar' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <CalendarIcon className="h-4 w-4" /> לוח שנה
              </button>
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                  view === 'list' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <List className="h-4 w-4" /> רשימת ימים
              </button>
            </div>
            <button
              onClick={handlePrint}
              disabled={summaries.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> הדפס
            </button>
          </div>
        </div>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile icon={<Users className="h-5 w-5" />} label="עובדים בדוח" value={summaries.length} color="brand" />
        <KpiTile icon={<CalendarIcon className="h-5 w-5" />} label="סה״כ ימי עבודה" value={grandTotalDays} color="emerald" />
        <KpiTile icon={<Clock className="h-5 w-5" />} label="סה״כ שעות" value={grandTotalHours.toFixed(1)} color="accent" />
        <KpiTile
          icon={<AlertCircle className="h-5 w-5" />}
          label="יציאות חסרות"
          value={summaries.reduce((s, e) => s + e.missingClockOut, 0)}
          color="rose"
        />
      </div>

      {/* Main content */}
      {summaries.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm font-medium text-slate-500">אין דיווחים לתקופה ולעובד שנבחרו</p>
            <p className="mt-1 text-xs text-slate-400">נסה לבחור חודש או עובד אחר</p>
          </div>
        </Card>
      ) : view === 'list' ? (
        <div className="space-y-5">
          {summaries.map((s) => (
            <ListCard key={s.profile.id} summary={s} requests={requests} onReload={onReload} />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {summaries.map((s) => (
            <CalendarCard key={s.profile.id} summary={s} monthKeyStr={selectedMonth} requests={requests} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- KPI tile ---------- */
function KpiTile({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'brand' | 'emerald' | 'accent' | 'rose';
}) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700 border-brand-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    accent: 'bg-accent-50 text-accent-700 border-accent-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-extrabold lg:text-3xl">{value}</span>
        <span className="opacity-50">{icon}</span>
      </div>
      <p className="mt-1 text-xs font-medium opacity-80 lg:text-sm">{label}</p>
    </div>
  );
}

/* ---------- Calendar card ---------- */
function CalendarCard({ summary, monthKeyStr, requests }: { summary: EmpSummary; monthKeyStr: string; requests: EmployeeRequest[] }) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startOffset = firstDay.getDay();

  const recordsByDay = new Map<number, Attendance[]>();
  summary.records.forEach((r) => {
    if (!r.clock_in) return;
    const d = new Date(r.clock_in);
    if (d.getFullYear() === y && d.getMonth() + 1 === m) {
      const arr = recordsByDay.get(d.getDate()) ?? [];
      arr.push(r);
      recordsByDay.set(d.getDate(), arr);
    }
  });

  // Weekly subtotals
  const weeklyTotals: { weekNum: number; hours: number; days: number }[] = [];
  const weekMap = new Map<number, { hours: number; days: number }>();
  summary.records.forEach((r) => {
    if (!r.clock_in) return;
    const d = new Date(r.clock_in);
    if (d.getFullYear() !== y || d.getMonth() + 1 !== m) return;
    const wn = getWeekNumber(d);
    const ex = weekMap.get(wn) ?? { hours: 0, days: 0 };
    ex.hours += parseHours(r.clock_in, r.clock_out);
    ex.days += 1;
    weekMap.set(wn, ex);
  });
  weekMap.forEach((v, wn) => weeklyTotals.push({ weekNum: wn, ...v }));
  weeklyTotals.sort((a, b) => a.weekNum - b.weekNum);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const maxWeekHours = Math.max(...weeklyTotals.map((w) => w.hours), 1);

  return (
    <Card>
      {/* Employee header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={summary.profile.full_name} size="md" />
          <div>
            <h3 className="text-base font-extrabold text-slate-800">{summary.profile.full_name}</h3>
            <p className="text-xs text-slate-400">
              {summary.daysWorked} ימים · {summary.totalHours.toFixed(1)} שעות · ממוצע{' '}
              {summary.daysWorked > 0 ? (summary.totalHours / summary.daysWorked).toFixed(1) : '—'} ש׳/יום
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.changeRequestCount > 0 && <Badge color="green">{summary.changeRequestCount} בקשות שינוי</Badge>}
          {summary.missingClockOut > 0 && <Badge color="red">{summary.missingClockOut} יציאה חסרה</Badge>}
        </div>
      </div>

      {/* Weekly mini-bars */}
      {weeklyTotals.length > 0 && (
        <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <div className="mb-2 text-xs font-bold text-slate-500">סיכום שבועי</div>
          <div className="flex flex-wrap gap-3">
            {weeklyTotals.map((w) => (
              <div key={w.weekNum} className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-slate-400">שבוע {w.weekNum}</span>
                <div className="h-5 w-24 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="flex h-full items-center justify-end rounded-full bg-gradient-to-l from-brand-400 to-brand-600 pl-1.5"
                    style={{ width: `${Math.max((w.hours / maxWeekHours) * 100, 8)}%` }}
                  >
                    <span className="text-[9px] font-bold text-white">{w.hours.toFixed(1)}ש׳</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400">{w.days} ימים</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="p-3 sm:p-4">
        {/* Day headers */}
        <div className="mb-1.5 grid grid-cols-7 gap-1">
          {DAY_NAMES_LONG.map((d, i) => (
            <div
              key={i}
              className={`pb-1 text-center text-[11px] font-bold ${
                i === 5 ? 'text-amber-600' : i === 6 ? 'text-rose-500' : 'text-slate-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="min-h-[72px] rounded-lg" />;

            const dow = new Date(y, m - 1, day).getDay();
            const isWeekend = dow === 5 || dow === 6;
            const dayRecords = recordsByDay.get(day) ?? [];
            const hasRecords = dayRecords.length > 0;
            const hasMissing = dayRecords.some((r) => !r.clock_out);
            const dayReqs = dayRecords.flatMap((r) => requestsForAttendanceRecord(r, requests, dayRecords));
            const hasChange = dayReqs.length > 0;
            const hasPendingReq = dayRecords.some((rec) =>
              requestsForAttendanceRecord(rec, requests, dayRecords).some((r) => effectiveRequestDecision(r, rec) === 'pending'),
            );
            const hasRejectedReq = dayRecords.some((rec) =>
              requestsForAttendanceRecord(rec, requests, dayRecords).some((r) => effectiveRequestDecision(r, rec) === 'rejected'),
            );
            const hasChangedReq = dayRecords.some((rec) =>
              requestsForAttendanceRecord(rec, requests, dayRecords).some((r) => effectiveRequestDecision(r, rec) === 'changed'),
            );

            const statusColor = !hasRecords
              ? ''
              : hasMissing
                ? 'border-rose-300 bg-rose-50/40'
                : hasPendingReq
                  ? 'border-amber-300 bg-amber-50/40'
                  : hasRejectedReq
                    ? 'border-rose-300 bg-rose-50/40'
                    : hasChangedReq
                      ? 'border-sky-300 bg-sky-50/40'
                      : hasChange
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-200 bg-white';

            const weekendBg = isWeekend
              ? dow === 6
                ? 'bg-rose-50/60 border-rose-100'
                : 'bg-amber-50/60 border-amber-100'
              : 'bg-white border-slate-150';

            return (
              <div
                key={idx}
                className={`group relative min-h-[72px] rounded-lg border p-1.5 transition hover:shadow-md ${
                  hasRecords ? statusColor : weekendBg
                }`}
              >
                {/* Day number */}
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isWeekend
                        ? dow === 6 ? 'text-rose-400' : 'text-amber-500'
                        : 'text-slate-600'
                    }`}
                  >
                    {day}
                  </span>
                  {hasRecords && (hasChange || hasMissing) && (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        hasMissing || hasRejectedReq
                          ? 'bg-rose-500'
                          : hasPendingReq
                            ? 'bg-amber-500'
                            : hasChangedReq
                              ? 'bg-sky-500'
                              : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </div>

                {/* Records */}
                {hasRecords && (
                  <div className="space-y-1">
                    {dayRecords.slice(0, 2).map((r, ri) => (
                      <div key={ri} className="rounded-md bg-white/80 px-1 py-0.5">
                        {dayRecords.length > 1 && (
                          <div className="text-[9px] font-extrabold text-indigo-600">משמרת {ri + 1}</div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] font-medium">
                          <LogIn className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                          <span className="text-slate-600">{formatTime(r.clock_in)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-medium">
                          {r.clock_out ? (
                            <>
                              <LogOut className="h-2.5 w-2.5 shrink-0 text-rose-500" />
                              <span className="text-slate-600">{formatTime(r.clock_out)}</span>
                            </>
                          ) : (
                            <span className="text-[9px] font-bold text-rose-500">יציאה חסרה</span>
                          )}
                        </div>
                        {r.clock_out && (
                          <div className="text-[10px] font-bold text-brand-600">
                            {parseHours(r.clock_in, r.clock_out).toFixed(1)} ש׳
                          </div>
                        )}
                      </div>
                    ))}
                    {dayRecords.length > 2 && (
                      <div className="text-center text-[9px] text-slate-400">
                        +{dayRecords.length - 2} נוספים
                      </div>
                    )}
                  </div>
                )}

                {/* Hover tooltip */}
                {hasRecords && (
                  <div className="pointer-events-none absolute inset-x-0 top-full z-20 hidden group-hover:block">
                    <div className="mt-1 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                      <p className="mb-2 text-xs font-bold text-slate-700">
                        {formatHebrewDate(dayRecords[0].clock_in)}
                      </p>
                      {dayRecords.map((r, ri) => (
                        <div key={ri} className="mb-2 last:mb-0 border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                          {dayRecords.length > 1 && (
                            <p className="mb-1 text-[10px] font-extrabold text-indigo-600">משמרת {ri + 1}</p>
                          )}
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-slate-500">כניסה</span>
                            <span className="font-bold text-slate-700">{formatTime(r.clock_in)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-slate-500">יציאה</span>
                            <span className="font-bold text-slate-700">{formatTime(r.clock_out) || '—'}</span>
                          </div>
                          {r.clock_out && (
                            <div className="flex items-center justify-between gap-4 text-[11px]">
                              <span className="text-slate-500">שעות</span>
                              <span className="font-bold text-brand-600">{parseHours(r.clock_in, r.clock_out).toFixed(1)}</span>
                            </div>
                          )}
                          <ChangeRequestBlock record={r} requests={requests} dayRecords={dayRecords} />
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-slate-500">מיקום</span>
                            <span className="font-medium text-slate-600">{r.location_verified ? 'מאומת' : 'לא מאומת'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-amber-200 bg-amber-50/60" /> שישי
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-rose-100 bg-rose-50/60" /> שבת
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> בקשה שאושרה
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> בקשה ששונתה
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> בקשה ממתינה
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> נדחה / יציאה חסרה
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ---------- List card (vertical day-by-day) ---------- */
function ListCard({ summary, requests, onReload }: { summary: EmpSummary; requests: EmployeeRequest[]; onReload: () => void }) {
  const [editing, setEditing] = useState<Attendance | null>(null);
  // Group records by day
  const byDay = new Map<string, Attendance[]>();
  summary.records.forEach((r) => {
    if (!r.clock_in) return;
    const key = new Date(r.clock_in).toDateString();
    const arr = byDay.get(key) ?? [];
    arr.push(r);
    byDay.set(key, arr);
  });
  const dayEntries = Array.from(byDay.entries()).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
  );

  return (
    <Card>
      {/* Employee header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={summary.profile.full_name} size="md" />
          <div>
            <h3 className="text-base font-extrabold text-slate-800">{summary.profile.full_name}</h3>
            <p className="text-xs text-slate-400">
              {summary.daysWorked} ימים · {summary.totalHours.toFixed(1)} שעות · ממוצע{' '}
              {summary.daysWorked > 0 ? (summary.totalHours / summary.daysWorked).toFixed(1) : '—'} ש׳/יום
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.changeRequestCount > 0 && <Badge color="green">{summary.changeRequestCount} בקשות שינוי</Badge>}
          {summary.missingClockOut > 0 && <Badge color="red">{summary.missingClockOut} יציאה חסרה</Badge>}
        </div>
      </div>

      {/* Day list */}
      <div className="divide-y divide-slate-100">
        {dayEntries.map(([dayKey, recs]) => {
          const d = new Date(dayKey);
          const dow = d.getDay();
          const isWeekend = dow === 5 || dow === 6;
          const dayHours = recs.reduce((s, r) => s + parseHours(r.clock_in, r.clock_out), 0);
          const hasMissing = recs.some((r) => !r.clock_out);

          return (
            <div
              key={dayKey}
              className={`flex flex-col gap-3 px-5 py-3 transition hover:bg-slate-50/50 sm:flex-row sm:items-center ${
                isWeekend ? (dow === 6 ? 'bg-rose-50/30' : 'bg-amber-50/30') : ''
              }`}
            >
              {/* Date column */}
              <div className="flex shrink-0 items-center gap-3 sm:w-40">
                <div
                  className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl border ${
                    isWeekend
                      ? dow === 6
                        ? 'border-rose-200 bg-rose-100/60'
                        : 'border-amber-200 bg-amber-100/60'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <span className={`text-lg font-extrabold leading-none ${
                    isWeekend ? (dow === 6 ? 'text-rose-600' : 'text-amber-600') : 'text-slate-700'
                  }`}>{d.getDate()}</span>
                  <span className={`text-[9px] font-bold ${
                    isWeekend ? (dow === 6 ? 'text-rose-400' : 'text-amber-500') : 'text-slate-400'
                  }`}>{DAY_NAMES_LONG[dow]}</span>
                </div>
                <div className="hidden sm:block">
                  <span className={`text-xs font-medium ${
                    isWeekend ? (dow === 6 ? 'text-rose-500' : 'text-amber-500') : 'text-slate-400'
                  }`}>{formatHebrewDate(recs[0].clock_in)}</span>
                </div>
              </div>

              {/* Records column */}
              <div className="flex flex-1 flex-col gap-2">
                {recs.map((r, ri) => (
                  <div key={ri} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {recs.length > 1 && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
                        משמרת {ri + 1}
                      </span>
                    )}
                    {/* Clock in */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                        <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">כניסה</div>
                        <div className="text-sm font-bold text-slate-700">{formatTime(r.clock_in)}</div>
                      </div>
                    </div>

                    {/* Clock out */}
                    <div className="flex items-center gap-1.5">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        r.clock_out ? 'bg-rose-50' : 'bg-rose-100'
                      }`}>
                        <LogOut className="h-3.5 w-3.5 text-rose-600" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">יציאה</div>
                        {r.clock_out ? (
                          <div className="text-sm font-bold text-slate-700">{formatTime(r.clock_out)}</div>
                        ) : (
                          <div className="text-sm font-bold text-rose-500">חסרה</div>
                        )}
                      </div>
                    </div>

                    {/* Hours */}
                    {r.clock_out && (
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50">
                          <Clock className="h-3.5 w-3.5 text-brand-600" />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">שעות</div>
                          <div className="text-sm font-bold text-brand-700">{parseHours(r.clock_in, r.clock_out).toFixed(1)}</div>
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    <div className="flex items-center gap-1.5">
                      {r.location_verified ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> מיקום מאומת
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                          <AlertCircle className="h-3.5 w-3.5" /> מיקום לא מאומת
                        </span>
                      )}
                    </div>

                    <ChangeRequestBlock record={r} requests={requests} dayRecords={recs} />

                    {/* Edit button */}
                    <button
                      onClick={() => setEditing(r)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-brand-100 hover:text-brand-700"
                      title="ערוך שעות"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Day subtotal */}
              <div className="shrink-0 text-left sm:w-20">
                <div className="text-[10px] text-slate-400">סה״כ יומי</div>
                <div className={`text-lg font-extrabold ${
                  hasMissing ? 'text-rose-600' : 'text-brand-700'
                }`}>{dayHours.toFixed(1)}</div>
                <div className="text-[10px] text-slate-400">שעות</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer total */}
      <div className="flex items-center justify-between border-t-2 border-slate-200 bg-slate-50 px-5 py-3">
        <span className="text-sm font-extrabold text-slate-700">סה״כ חודשי</span>
        <span className="text-lg font-extrabold text-brand-700">{summary.totalHours.toFixed(1)} שעות</span>
      </div>

      {editing && (
        <EditRecordModal
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onReload();
          }}
        />
      )}
    </Card>
  );
}

/* ---------- Edit record modal ---------- */
function EditRecordModal({
  record,
  onClose,
  onSaved,
}: {
  record: Attendance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clockIn, setClockIn] = useState(toDateTimeLocal(record.clock_in));
  const [clockOut, setClockOut] = useState(toDateTimeLocal(record.clock_out));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const updates: { clock_in: string | null; clock_out: string | null } = {
      clock_in: clockIn ? fromDateTimeLocal(clockIn) : null,
      clock_out: clockOut ? fromDateTimeLocal(clockOut) : null,
    };
    const { error } = await supabase.from('attendance').update(updates).eq('id', record.id);
    if (error) {
      setErr(error.message);
      setBusy(false);
    } else {
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">עריכת שעות דיווח</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">{formatHebrewDate(record.clock_in)}</p>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">שעת כניסה</label>
            <input
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">שעת יציאה</label>
            <input
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white"
            />
          </div>
        </div>
        {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100">ביטול</button>
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </Card>
    </div>
  );
}
