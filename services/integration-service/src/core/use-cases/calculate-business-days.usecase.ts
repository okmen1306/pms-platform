import type { HolidayRepository } from '../../infrastructure/database/holiday.repository';

export interface BusinessDaysResult {
  totalCalendarDays: number;
  totalBusinessDays: number;
  excludedHolidayDates: string[];
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Kural (docs/roadmap.md madde 3): Proje süresi hesaplanırken resmî tatil günleri iş günü
 * hesaplamasından düşülür. Bu, sistemdeki TEK doğru kaynaktır — project-service, procurement-
 * service ve finance-service kendi tatil/iş günü mantığını yeniden yazmaz, buraya REST çağrısı
 * yapar (bkz. shared/utils/date.helper.ts BusinessDaysClient arayüzü).
 *
 * Not: Cumartesi/Pazar da hafta sonu olarak iş günü dışı sayılır (Türkiye standart 5 günlük
 * iş haftası varsayımı).
 */
export async function calculateBusinessDays(
  startDate: string,
  endDate: string,
  holidayRepo: HolidayRepository,
): Promise<BusinessDaysResult> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) {
    throw new Error('startDate, endDate\'ten sonra olamaz');
  }

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const holidaySet = new Set<string>();
  for (let year = startYear; year <= endYear; year++) {
    const holidays = (await holidayRepo.findByYear(year)) as Array<{ tarih: string }>;
    holidays.forEach((h) => holidaySet.add(h.tarih));
  }

  let totalCalendarDays = 0;
  let totalBusinessDays = 0;
  const excludedHolidayDates: string[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    totalCalendarDays++;
    const iso = toIsoDate(d);
    const dayOfWeek = d.getDay(); // 0 = Pazar, 6 = Cumartesi
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(iso);

    if (isHoliday) excludedHolidayDates.push(iso);
    if (!isWeekend && !isHoliday) totalBusinessDays++;
  }

  return { totalCalendarDays, totalBusinessDays, excludedHolidayDates };
}
