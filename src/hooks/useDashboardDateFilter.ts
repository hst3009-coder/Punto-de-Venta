import { useState, useMemo } from 'react';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  addMonths,
  subMonths,
} from 'date-fns';

export type FilterType = 'Día' | 'Semana' | 'Mes' | 'Rango';

const spanishMonths = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const spanishMonthsShort = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export function formatSpanishDate(date: Date): string {
  return `${date.getDate()} de ${spanishMonths[date.getMonth()]}, ${date.getFullYear()}`;
}

export function formatSpanishMonthYear(date: Date): string {
  return `${spanishMonths[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatSpanishWeekRange(weekStart: Date, weekEnd: Date): string {
  const startDay = weekStart.getDate();
  const startMonth = spanishMonthsShort[weekStart.getMonth()];
  const endDay = weekEnd.getDate();
  const endMonth = spanishMonthsShort[weekEnd.getMonth()];
  const startYear = weekStart.getFullYear();
  const endYear = weekEnd.getFullYear();

  if (startYear === endYear) {
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `Semana del ${startDay} al ${endDay} de ${spanishMonths[weekStart.getMonth()]}, ${startYear}`;
    } else {
      return `Semana del ${startDay} de ${startMonth} al ${endDay} de ${endMonth}, ${startYear}`;
    }
  } else {
    return `Semana del ${startDay} de ${startMonth}, ${startYear} al ${endDay} de ${endMonth}, ${endYear}`;
  }
}

export function useDashboardDateFilter() {
  const [filterType, setFilterType] = useState<FilterType>('Mes');
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [selectedWeekAnchor, setSelectedWeekAnchor] = useState<Date>(() => new Date());
  const [selectedMonthAnchor, setSelectedMonthAnchor] = useState<Date>(() => new Date());
  const [customRangeStart, setCustomRangeStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customRangeEnd, setCustomRangeEnd] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  const { start, end } = useMemo(() => {
    if (filterType === 'Día') {
      return {
        start: startOfDay(selectedDay),
        end: endOfDay(selectedDay),
      };
    } else if (filterType === 'Semana') {
      return {
        start: startOfWeek(selectedWeekAnchor, { weekStartsOn: 1 }),
        end: endOfWeek(selectedWeekAnchor, { weekStartsOn: 1 }),
      };
    } else if (filterType === 'Mes') {
      return {
        start: startOfMonth(selectedMonthAnchor),
        end: endOfMonth(selectedMonthAnchor),
      };
    } else {
      const startDate = new Date(customRangeStart + 'T00:00:00');
      const endDate = new Date(customRangeEnd + 'T23:59:59');
      return {
        start: startOfDay(isNaN(startDate.getTime()) ? new Date() : startDate),
        end: endOfDay(isNaN(endDate.getTime()) ? new Date() : endDate),
      };
    }
  }, [filterType, selectedDay, selectedWeekAnchor, selectedMonthAnchor, customRangeStart, customRangeEnd]);

  const handlePrev = () => {
    if (filterType === 'Día') {
      setSelectedDay((prev) => subDays(prev, 1));
    } else if (filterType === 'Semana') {
      setSelectedWeekAnchor((prev) => subDays(prev, 7));
    } else if (filterType === 'Mes') {
      setSelectedMonthAnchor((prev) => subMonths(prev, 1));
    }
  };

  const handleNext = () => {
    if (filterType === 'Día') {
      setSelectedDay((prev) => addDays(prev, 1));
    } else if (filterType === 'Semana') {
      setSelectedWeekAnchor((prev) => addDays(prev, 7));
    } else if (filterType === 'Mes') {
      setSelectedMonthAnchor((prev) => addMonths(prev, 1));
    }
  };

  const formattedRangeText = useMemo(() => {
    if (filterType === 'Día') {
      return formatSpanishDate(selectedDay);
    } else if (filterType === 'Semana') {
      const wStart = startOfWeek(selectedWeekAnchor, { weekStartsOn: 1 });
      const wEnd = endOfWeek(selectedWeekAnchor, { weekStartsOn: 1 });
      return formatSpanishWeekRange(wStart, wEnd);
    } else if (filterType === 'Mes') {
      return formatSpanishMonthYear(selectedMonthAnchor);
    }
    return '';
  }, [filterType, selectedDay, selectedWeekAnchor, selectedMonthAnchor]);

  return {
    filterType,
    setFilterType,
    selectedDay,
    setSelectedDay,
    selectedWeekAnchor,
    setSelectedWeekAnchor,
    selectedMonthAnchor,
    setSelectedMonthAnchor,
    customRangeStart,
    setCustomRangeStart,
    customRangeEnd,
    setCustomRangeEnd,
    start,
    end,
    handlePrev,
    handleNext,
    formattedRangeText,
    spanishMonths,
    spanishMonthsShort,
  };
}
