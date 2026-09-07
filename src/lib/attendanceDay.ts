import { addCalendarDays, combineLocalDateTime, israelDateKey } from '@/lib/hoursAdjustment';

/** Shifts left open longer than this are treated as a forgotten clock-out, not still in progress. */
export const MAX_OPEN_SHIFT_MS = 18 * 60 * 60 * 1000;

type ClockTimes = {
  clock_in: string | null;
  clock_out: string | null;
};

export function israelStartOfDay(now: Date = new Date()): Date {
  return new Date(combineLocalDateTime(israelDateKey(now.toISOString()), '00:00'));
}

export function israelYesterdayStart(now: Date = new Date()): Date {
  const todayKey = israelDateKey(now.toISOString());
  return new Date(combineLocalDateTime(addCalendarDays(todayKey, -1), '00:00'));
}

export function isActiveOpenShift(record: ClockTimes, now: Date = new Date()): boolean {
  if (!record.clock_in || record.clock_out) return false;
  const started = new Date(record.clock_in).getTime();
  if (isNaN(started)) return false;
  const elapsed = now.getTime() - started;
  return elapsed >= 0 && elapsed <= MAX_OPEN_SHIFT_MS;
}

export function isMissingClockOut(record: ClockTimes, now: Date = new Date()): boolean {
  return !!record.clock_in && !record.clock_out && !isActiveOpenShift(record, now);
}

/** Today's work: started today, ended today (overnight), or still an in-progress overnight shift. */
export function isTodayAttendance(record: ClockTimes, now: Date = new Date()): boolean {
  const start = israelStartOfDay(now);
  if (isActiveOpenShift(record, now)) return true;
  if (record.clock_in && new Date(record.clock_in) >= start) return true;
  if (record.clock_out && new Date(record.clock_out) >= start) return true;
  return false;
}

export function openShiftLabel(record: ClockTimes, now: Date = new Date()): 'פתוחה' | 'יציאה חסרה' {
  return isActiveOpenShift(record, now) ? 'פתוחה' : 'יציאה חסרה';
}
