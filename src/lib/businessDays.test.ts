import { describe, it, expect } from 'vitest';
import { getNextBusinessDay } from './businessDays';
import { format } from 'date-fns';

describe('businessDays.ts unit tests', () => {
  it('returns Wednesday for a normal Tuesday', () => {
    // 2026-07-21 is a Tuesday
    const tuesday = new Date(2026, 6, 21, 12, 0, 0);
    const result = getNextBusinessDay(tuesday, []);
    expect(format(result, 'yyyy-MM-dd')).toBe('2026-07-22'); // Wednesday
  });

  it('returns Monday when starting on Friday', () => {
    // 2026-07-24 is a Friday
    const friday = new Date(2026, 6, 24, 12, 0, 0);
    const result = getNextBusinessDay(friday, []);
    expect(format(result, 'yyyy-MM-dd')).toBe('2026-07-27'); // Monday
  });

  it('skips a holiday on a weekday', () => {
    // 2026-07-28 is Tuesday. Wednesday 2026-07-29 is a holiday.
    const tuesday = new Date(2026, 6, 28, 12, 0, 0);
    const holidays = ['2026-07-29'];
    const result = getNextBusinessDay(tuesday, holidays);
    expect(format(result, 'yyyy-MM-dd')).toBe('2026-07-30'); // Thursday
  });

  it('skips weekends and a holiday falling on Monday', () => {
    // 2026-07-24 is Friday. 2026-07-25 (Sat), 2026-07-26 (Sun), 2026-07-27 (Mon - Holiday)
    const friday = new Date(2026, 6, 24, 12, 0, 0);
    const holidays = ['2026-07-25', '2026-07-27']; // Saturday and Monday holidays
    const result = getNextBusinessDay(friday, holidays);
    expect(format(result, 'yyyy-MM-dd')).toBe('2026-07-28'); // Tuesday
  });
});
