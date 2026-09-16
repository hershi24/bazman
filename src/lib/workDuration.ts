/** Whole minutes between clock-in and clock-out. Incomplete seconds are not counted. */
export function minutesBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return null;
  return Math.floor((e - s) / 60000);
}

export function minutesBetweenOrZero(start: string | null, end: string | null): number {
  return minutesBetween(start, end) ?? 0;
}

export function formatHm(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes) || totalMinutes < 0) return '—';
  const m = Math.round(totalMinutes);
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

export function formatHmLabel(totalMinutes: number | null | undefined): string {
  const hm = formatHm(totalMinutes);
  return hm === '—' ? '—' : `${hm} שעות`;
}

export function formatHmHtml(totalMinutes: number | null | undefined): string {
  const hm = formatHm(totalMinutes);
  if (hm === '—') return '—';
  return `<span dir="ltr">${hm}</span>`;
}

export function averageMinutes(totalMinutes: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round(totalMinutes / count);
}
