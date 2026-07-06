export interface ImportDayRange {
  from: Date;
  to: Date;
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function importDayRange(dates: Date[]): ImportDayRange | null {
  if (dates.length === 0) return null;

  let min = isoDay(dates[0]);
  let max = min;
  for (const date of dates.slice(1)) {
    const day = isoDay(date);
    if (day < min) min = day;
    if (day > max) max = day;
  }

  return {
    from: new Date(`${min}T00:00:00.000Z`),
    to: new Date(`${max}T23:59:59.999Z`),
  };
}
