import { format, addDays } from 'date-fns';

/**
 * Calculates the next business day (excluding Saturdays, Sundays, and holidays).
 * @param date The starting date (typically the batch/sale date)
 * @param holidays Array of YYYY-MM-DD strings representing holidays
 */
export function getNextBusinessDay(date: Date, holidays: string[]): Date {
  let current = new Date(date);
  const holidaySet = new Set(holidays);

  // We loop day by day starting from the next day
  while (true) {
    current = addDays(current, 1);
    const dayOfWeek = current.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }
    const formatted = format(current, 'yyyy-MM-dd');
    if (holidaySet.has(formatted)) {
      continue;
    }
    break;
  }

  return current;
}
