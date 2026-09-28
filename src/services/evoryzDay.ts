/** The EvoRyz day begins at 02:00 in the device's local time zone. */
export const DAY_BOUNDARY_HOUR = 2;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function evoryzDay(date = new Date()): string {
  const adjusted = new Date(date);
  adjusted.setHours(adjusted.getHours() - DAY_BOUNDARY_HOUR);
  const y = adjusted.getFullYear();
  const m = pad2(adjusted.getMonth() + 1);
  const d = pad2(adjusted.getDate());
  return `${y}-${m}-${d}`;
}

export function previousEvoDay(day: string): string {
  const parts = day.split('-').map((p) => parseInt(p, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const date = new Date(parts[0], parts[1] - 1, parts[2] - 1, 12, 0, 0);
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    return `${y}-${m}-${d}`;
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() - 1);
  return evoryzDay(fallback);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function displayEvoDay(day: string): string {
  if (!day || typeof day !== 'string') return '';
  const parts = day.split('-').map((p) => parseInt(p, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const month = MONTH_NAMES[parts[1] - 1] || '';
    return `${month} ${parts[2]}`;
  }
  try {
    const d = new Date(day);
    if (!isNaN(d.getTime())) {
      const month = MONTH_NAMES[d.getMonth()] || '';
      return `${month} ${d.getDate()}`;
    }
  } catch {
    // fallback
  }
  return day;
}

/**
 * Returns the exact Date of the upcoming 02:00 AM local device boundary.
 * If current time is 01:30 AM, returns today at 02:00 AM.
 * If current time is 02:00 AM or later, returns tomorrow at 02:00 AM.
 */
export function getNext2amBoundaryDate(now = new Date()): Date {
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(0);
  next.setHours(DAY_BOUNDARY_HOUR);
  if (now.getTime() >= next.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Returns milliseconds remaining until the upcoming 02:00 AM local device boundary.
 */
export function getTimeUntilNext2amBoundary(now = new Date()): number {
  return Math.max(0, getNext2amBoundaryDate(now).getTime() - now.getTime());
}
