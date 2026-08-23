import { supabase } from '@/lib/supabase';
import type { EmployeeRequest } from '@/types';

export const HOURS_ADJUST_TYPE = 'התאמת שעות';

export type HoursAdjustment = {
  clockIn: string | null;
  clockOut: string | null;
  originalClockIn: string | null;
  originalClockOut: string | null;
  note: string;
  attendanceId: string | null;
  shiftNumber: number | null;
};

export function isHoursAdjustmentType(type: string): boolean {
  return type.trim() === HOURS_ADJUST_TYPE;
}

function padTime(raw: string): string {
  const [h, m] = raw.split(':');
  return `${String(Number(h)).padStart(2, '0')}:${String(Number(m)).padStart(2, '0')}`;
}

export function formatHoursAdjustmentPayload(adj: HoursAdjustment): string {
  const lines: string[] = [];
  if (adj.shiftNumber && adj.shiftNumber > 1) lines.push(`משמרת: ${adj.shiftNumber}`);
  else if (adj.shiftNumber === 1) lines.push(`משמרת: 1`);
  if (adj.attendanceId) lines.push(`דיווח: ${adj.attendanceId}`);
  if (adj.clockIn) lines.push(`כניסה: ${padTime(adj.clockIn)}`);
  if (adj.clockOut) lines.push(`יציאה: ${padTime(adj.clockOut)}`);
  if (adj.originalClockIn) lines.push(`מקורי כניסה: ${padTime(adj.originalClockIn)}`);
  if (adj.originalClockOut) lines.push(`מקורי יציאה: ${padTime(adj.originalClockOut)}`);
  if (adj.note.trim()) {
    if (lines.length) lines.push('');
    lines.push(adj.note.trim());
  }
  return lines.join('\n');
}

export function parseHoursAdjustment(description: string | null | undefined): HoursAdjustment | null {
  if (!description?.trim()) return null;
  let clockIn: string | null = null;
  let clockOut: string | null = null;
  let originalClockIn: string | null = null;
  let originalClockOut: string | null = null;
  let attendanceId: string | null = null;
  let shiftNumber: number | null = null;
  const noteLines: string[] = [];
  for (const line of description.split(/\r?\n/)) {
    const t = line.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();
    const shiftMatch = t.match(/^משמרת:\s*(\d+)/);
    const idMatch = t.match(/^דיווח:\s*([0-9a-f-]{36})/i);
    const origIn = t.match(/^מקורי כניסה:\s*(\d{1,2}:\d{2})/);
    const origOut = t.match(/^מקורי יציאה:\s*(\d{1,2}:\d{2})/);
    const inMatch = t.match(/^כניסה:\s*(\d{1,2}:\d{2})/);
    const outMatch = t.match(/^יציאה:\s*(\d{1,2}:\d{2})/);
    if (shiftMatch) {
      shiftNumber = Number(shiftMatch[1]);
      continue;
    }
    if (idMatch) {
      attendanceId = idMatch[1];
      continue;
    }
    if (origIn) {
      originalClockIn = padTime(origIn[1]);
      continue;
    }
    if (origOut) {
      originalClockOut = padTime(origOut[1]);
      continue;
    }
    if (inMatch) {
      clockIn = padTime(inMatch[1]);
      continue;
    }
    if (outMatch) {
      clockOut = padTime(outMatch[1]);
      continue;
    }
    if (t) noteLines.push(t);
  }
  if (!clockIn && !clockOut) return null;
  return {
    clockIn,
    clockOut,
    originalClockIn,
    originalClockOut,
    note: noteLines.join('\n').trim(),
    attendanceId,
    shiftNumber,
  };
}

export function shiftLabel(shiftNumber: number | null | undefined, totalShifts?: number): string {
  if (!shiftNumber || shiftNumber < 1) return '';
  if (totalShifts !== undefined && totalShifts <= 1) return '';
  if (totalShifts === undefined && shiftNumber <= 1) return '';
  return `משמרת ${shiftNumber}`;
}

export function hoursAdjustmentSummary(adj: HoursAdjustment): string {
  const parts: string[] = [];
  const shift = shiftLabel(adj.shiftNumber);
  if (shift) parts.push(shift);
  if (adj.clockIn) parts.push(`כניסה ${adj.clockIn}`);
  if (adj.clockOut) parts.push(`יציאה ${adj.clockOut}`);
  return parts.join(' · ');
}

export function originalHoursSummary(adj: HoursAdjustment): string {
  if (!adj.originalClockIn && !adj.originalClockOut) return '';
  const parts: string[] = [];
  if (adj.originalClockIn) parts.push(`כניסה ${adj.originalClockIn}`);
  if (adj.originalClockOut) parts.push(`יציאה ${adj.originalClockOut}`);
  return parts.join(' · ');
}

function minutesOf(hhmm: string): number {
  const [h, m] = padTime(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function timesMatch(actual: string | null, requested: string | null): boolean {
  if (!requested) return true;
  if (!actual) return false;
  return Math.abs(minutesOf(actual) - minutesOf(requested)) <= 2;
}

export function timeFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  if (!hour || !minute) return null;
  return padTime(`${hour}:${minute}`);
}

function requestStatus(req: EmployeeRequest): string {
  return String(req.status ?? '').trim().toLowerCase();
}

export function effectiveRequestDecision(
  req: EmployeeRequest,
  record?: { clock_in: string | null; clock_out: string | null } | null,
): 'pending' | 'approved' | 'rejected' | 'changed' {
  if (requestStatus(req) === 'rejected') return 'rejected';
  if (requestStatus(req) === 'approved') return changeRequestDecisionFromStatus(req);
  const adj = parseHoursAdjustment(req.description);
  if (adj && record) {
    const inOk = timesMatch(timeFromIso(record.clock_in), adj.clockIn);
    const outOk = timesMatch(timeFromIso(record.clock_out), adj.clockOut);
    if (inOk && outOk) return req.manager_note?.trim() ? 'changed' : 'approved';
  }
  return 'pending';
}

function changeRequestDecisionFromStatus(req: EmployeeRequest): 'pending' | 'approved' | 'rejected' | 'changed' {
  if (requestStatus(req) === 'pending') return 'pending';
  if (requestStatus(req) === 'rejected') return 'rejected';
  if (req.manager_note?.trim()) return 'changed';
  return 'approved';
}

export function israelDateKey(value: string | null | undefined): string {
  if (!value) return '';
  const raw = value.trim();
  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  const timePart = raw.slice(10);
  if (dateOnly && (!timePart || /^T00:00:00(\.0+)?(Z|[+-]00:00)?$/.test(timePart))) {
    return dateOnly[1];
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime()) && (timePart.includes('T') || /Z|[+-]\d{2}:\d{2}/.test(timePart))) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
  }
  if (dateOnly) return dateOnly[1];
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
}

function localDateKey(value: string | null | undefined): string {
  return israelDateKey(value);
}

export function sameDayAttendance<T extends { clock_in: string | null }>(rows: T[], date: string): T[] {
  return rows
    .filter((r) => localDateKey(r.clock_in) === date)
    .sort((a, b) => new Date(a.clock_in ?? 0).getTime() - new Date(b.clock_in ?? 0).getTime());
}

export function pickAttendanceForHoursAdjustment<
  T extends { id: string; clock_in: string | null; clock_out: string | null },
>(rows: T[], date: string, adj: HoursAdjustment): T | null {
  const day = sameDayAttendance(rows, date);
  if (adj.attendanceId) {
    const byId = day.find((r) => r.id === adj.attendanceId);
    if (byId) return byId;
  }
  if (adj.shiftNumber && adj.shiftNumber >= 1 && adj.shiftNumber <= day.length) {
    return day[adj.shiftNumber - 1];
  }
  if (adj.originalClockIn) {
    const byOrig = day.find(
      (r) =>
        timesMatch(timeFromIso(r.clock_in), adj.originalClockIn) &&
        timesMatch(timeFromIso(r.clock_out), adj.originalClockOut),
    );
    if (byOrig) return byOrig;
  }
  return day[0] ?? null;
}

export function combineLocalDateTime(dateStr: string, timeStr: string): string {
  const key = localDateKey(dateStr);
  const [hh, mm] = padTime(timeStr).split(':');
  const wanted = padTime(timeStr);
  for (const offset of ['+03:00', '+02:00']) {
    const iso = new Date(`${key}T${hh}:${mm}:00${offset}`).toISOString();
    if (timeFromIso(iso) === wanted) return iso;
  }
  return new Date(`${key}T${hh}:${mm}:00+03:00`).toISOString();
}

export async function setRequestStatus(
  id: string,
  status: 'approved' | 'rejected',
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('requests')
    .update({ status })
    .eq('id', id)
    .select('id, status')
    .maybeSingle();
  if (!error && data?.id) return { error: null };

  const { data: rpcId, error: rpcError } = await supabase.rpc('manager_set_request_status', {
    p_id: id,
    p_status: status,
  });
  if (!rpcError && rpcId) return { error: null };

  return {
    error: error?.message || rpcError?.message || 'השעות עודכנו, אבל סטטוס הבקשה נשאר ממתין. הרץ את ה-SQL של עדכון סטטוס בקשות.',
  };
}

async function applyViaEdgeFunction(
  employeeId: string,
  date: string,
  clockIn: string | null,
  clockOut: string | null,
  attendanceId: string | null,
  shiftNumber: number | null,
): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  if (!token || !base) return false;
  const payload = JSON.stringify({
    action: 'apply-hours',
    employeeId,
    date,
    clockIn,
    clockOut,
    attendanceId,
    shiftNumber,
  });
  for (const name of ['update-employee-auth', 'create-employee']) {
    try {
      const res = await fetch(`${base}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: anon,
        },
        body: payload,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

export async function applyHoursAdjustment(req: EmployeeRequest): Promise<{ error: string | null }> {
  if (!isHoursAdjustmentType(req.type)) return { error: null };
  const adj = parseHoursAdjustment(req.description);
  const date = localDateKey(req.requested_date);
  if (!adj || !date) return { error: null };
  if (!adj.clockIn && !adj.clockOut) return { error: null };

  const { data: rows, error: selErr } = await supabase
    .from('attendance')
    .select('id, clock_in, clock_out')
    .eq('user_id', req.user_id)
    .order('clock_in', { ascending: true })
    .limit(200);
  if (selErr) return { error: selErr.message };

  const existing = pickAttendanceForHoursAdjustment(rows ?? [], date, adj);

  if (
    await applyViaEdgeFunction(
      req.user_id,
      date,
      adj.clockIn,
      adj.clockOut,
      existing?.id ?? adj.attendanceId,
      adj.shiftNumber,
    )
  ) {
    return { error: null };
  }
  const patch: Record<string, unknown> = {};
  if (adj.clockIn) patch.clock_in = combineLocalDateTime(date, adj.clockIn);
  if (adj.clockOut) patch.clock_out = combineLocalDateTime(date, adj.clockOut);

  const finalIn = String(patch.clock_in ?? existing?.clock_in ?? '');
  const finalOut = String(patch.clock_out ?? existing?.clock_out ?? '');
  if (finalIn && finalOut && new Date(finalOut).getTime() < new Date(finalIn).getTime()) {
    return { error: 'שעת היציאה המבוקשת מוקדמת משעת הכניסה.' };
  }

  if (existing) {
    const { error } = await supabase.from('attendance').update(patch).eq('id', existing.id);
    if (!error) return { error: null };
    if (!/row-level security/i.test(error.message)) return { error: error.message };
  } else {
    const { error: rpcError } = await supabase.rpc('apply_hours_adjustment', {
      p_user_id: req.user_id,
      p_date: date,
      p_clock_in: adj.clockIn,
      p_clock_out: adj.clockOut,
    });
    if (!rpcError) return { error: null };
  }

  if (!existing && adj.clockIn) {
    const { error } = await supabase.from('attendance').insert({
      user_id: req.user_id,
      clock_in: patch.clock_in,
      clock_out: patch.clock_out ?? null,
      lat: null,
      lng: null,
      location_verified: false,
      qr_verified: false,
      note: 'עודכן מאישור התאמת שעות',
      status: 'approved',
    });
    if (!error) return { error: null };
  }

  return {
    error:
      'לא ניתן לעדכן את השעות כי אין דיווח ביום הזה (או שחסרה הרשאה ליצור דיווח). הוסף דיווח ב«ניהול דיווחים לעובד» ואז אשר שוב, או אשר בקשה ליום שבו כבר יש כניסה.',
  };
}
