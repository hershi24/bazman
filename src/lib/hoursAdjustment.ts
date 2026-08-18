import { supabase } from '@/lib/supabase';
import type { EmployeeRequest } from '@/types';

export const HOURS_ADJUST_TYPE = 'התאמת שעות';

export type HoursAdjustment = {
  clockIn: string | null;
  clockOut: string | null;
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
  const noteLines: string[] = [];
  for (const line of description.split(/\r?\n/)) {
    const inMatch = line.match(/^כניסה:\s*(\d{1,2}:\d{2})\s*$/);
    const outMatch = line.match(/^יציאה:\s*(\d{1,2}:\d{2})\s*$/);
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
  return { clockIn, clockOut, note: noteLines.join('\n').trim() };
}

export function hoursAdjustmentSummary(adj: HoursAdjustment): string {
  const parts: string[] = [];
  if (adj.clockIn) parts.push(`כניסה ${adj.clockIn}`);
  if (adj.clockOut) parts.push(`יציאה ${adj.clockOut}`);
  return parts.join(' · ');
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
  const [y, m, d] = key.split('-').map(Number);
  const [hh, mm] = padTime(timeStr).split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

function dayBounds(dateStr: string): { start: string; end: string } {
  const key = localDateKey(dateStr);
  const [y, m, d] = key.split('-').map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0).toISOString(),
    end: new Date(y, m - 1, d, 23, 59, 59, 999).toISOString(),
  };
}

export async function applyHoursAdjustment(req: EmployeeRequest): Promise<{ error: string | null }> {
  if (!isHoursAdjustmentType(req.type)) return { error: null };
  const adj = parseHoursAdjustment(req.description);
  const date = localDateKey(req.requested_date);
  if (!adj || !date) return { error: null };
  if (!adj.clockIn && !adj.clockOut) return { error: null };

  const { start, end } = dayBounds(date);
  const { data: rows, error: selErr } = await supabase
    .from('attendance')
    .select('id, clock_in, clock_out')
    .eq('user_id', req.user_id)
    .gte('clock_in', start)
    .lte('clock_in', end)
    .order('clock_in', { ascending: true });
  if (selErr) return { error: selErr.message };

  const existing = rows?.[0] ?? null;
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
    return { error: error?.message ?? null };
  }

  if (!adj.clockIn) {
    return { error: 'אין דיווח ביום זה. כדי ליצור דיווח חדש צריך גם שעת כניסה.' };
  }

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
  return { error: error?.message ?? null };
}
