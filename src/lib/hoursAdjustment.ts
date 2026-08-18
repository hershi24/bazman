import { supabase } from '@/lib/supabase';
import type { EmployeeRequest } from '@/types';

export const HOURS_ADJUST_TYPE = 'התאמת שעות';

export type HoursAdjustment = {
  clockIn: string | null;
  clockOut: string | null;
  originalClockIn: string | null;
  originalClockOut: string | null;
  note: string;
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
  const noteLines: string[] = [];
  for (const line of description.split(/\r?\n/)) {
    const origIn = line.match(/^מקורי כניסה:\s*(\d{1,2}:\d{2})\s*$/);
    const origOut = line.match(/^מקורי יציאה:\s*(\d{1,2}:\d{2})\s*$/);
    const inMatch = line.match(/^כניסה:\s*(\d{1,2}:\d{2})\s*$/);
    const outMatch = line.match(/^יציאה:\s*(\d{1,2}:\d{2})\s*$/);
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
    noteLines.push(line);
  }
  if (!clockIn && !clockOut) return null;
  return { clockIn, clockOut, originalClockIn, originalClockOut, note: noteLines.join('\n').trim() };
}

export function hoursAdjustmentSummary(adj: HoursAdjustment): string {
  const parts: string[] = [];
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

export function timeFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return padTime(`${d.getHours()}:${d.getMinutes()}`);
}

export function effectiveRequestDecision(
  req: EmployeeRequest,
  record?: { clock_in: string | null; clock_out: string | null } | null,
): 'pending' | 'approved' | 'rejected' | 'changed' {
  if (req.status === 'rejected') return 'rejected';
  if (req.status === 'approved') return changeRequestDecisionFromStatus(req);
  const adj = parseHoursAdjustment(req.description);
  if (adj && record) {
    const inOk = !adj.clockIn || timeFromIso(record.clock_in) === adj.clockIn;
    const outOk = !adj.clockOut || timeFromIso(record.clock_out) === adj.clockOut;
    if (inOk && outOk) return req.manager_note?.trim() ? 'changed' : 'approved';
  }
  return 'pending';
}

function changeRequestDecisionFromStatus(req: EmployeeRequest): 'pending' | 'approved' | 'rejected' | 'changed' {
  if (req.status === 'pending') return 'pending';
  if (req.status === 'rejected') return 'rejected';
  if (req.manager_note?.trim()) return 'changed';
  return 'approved';
}

function localDateKey(value: string | null | undefined): string {
  if (!value) return '';
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function combineLocalDateTime(dateStr: string, timeStr: string): string {
  const key = localDateKey(dateStr);
  const [hh, mm] = padTime(timeStr).split(':');
  return new Date(`${key}T${hh}:${mm}:00+03:00`).toISOString();
}

async function applyViaEdgeFunction(
  employeeId: string,
  date: string,
  clockIn: string | null,
  clockOut: string | null,
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

  if (await applyViaEdgeFunction(req.user_id, date, adj.clockIn, adj.clockOut)) {
    return { error: null };
  }

  const { data: rows, error: selErr } = await supabase
    .from('attendance')
    .select('id, clock_in, clock_out')
    .eq('user_id', req.user_id)
    .order('clock_in', { ascending: false })
    .limit(120);
  if (selErr) return { error: selErr.message };

  const existing = (rows ?? []).find((r) => localDateKey(r.clock_in) === date) ?? null;
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
