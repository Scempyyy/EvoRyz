/** The EvoRyz day begins at 02:00 in the device's local time zone. */
export const DAY_BOUNDARY_HOUR = 2;

export function evoryzDay(date = new Date()): string {
  const adjusted = new Date(date);
  adjusted.setHours(adjusted.getHours() - DAY_BOUNDARY_HOUR);
  return adjusted.toLocaleDateString('en-CA');
}

export function previousEvoDay(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString('en-CA');
}

export function displayEvoDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}
