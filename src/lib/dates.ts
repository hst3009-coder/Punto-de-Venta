import { Sale } from '../types';

export function getSaleTimestamp(sale: { date: string; createdAt?: string }): number {
  if (sale.createdAt) {
    const time = new Date(sale.createdAt).getTime();
    if (!isNaN(time)) return time;
  }
  
  const anySale = sale as any;
  const rawDate = sale.createdAt || anySale.updatedAt || sale.date;
  
  const parsed = new Date(rawDate).getTime();
  if (!isNaN(parsed)) return parsed;

  // Custom parser for "DD/MM/YYYY, HH:mm:ss" or similar spanish date formats
  if (typeof rawDate === 'string') {
    const match = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 0-indexed
      const year = parseInt(match[3], 10);
      const hours = match[4] ? parseInt(match[4], 10) : 0;
      const minutes = match[5] ? parseInt(match[5], 10) : 0;
      const seconds = match[6] ? parseInt(match[6], 10) : 0;
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  return 0;
}
