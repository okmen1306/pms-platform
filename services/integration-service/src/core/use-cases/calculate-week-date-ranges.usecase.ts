import type { HolidayRepository } from '../../infrastructure/database/holiday.repository';
import { calculateBusinessDays } from './calculate-business-days.usecase';

export interface WeekRange {
  weekNo: number;
  startDate: string;
  endDate: string;
  businessDays: number;
  excludedHolidayDates: string[];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Projenin her haftasının hangi takvim tarih aralığına karşılık geldiğini, tatil günlerine
 * dikkat ederek hesaplar (docs/roadmap.md — "Proje Planlama" bölümü). Her hafta 7 takvim günü
 * olarak dilimlenir; o hafta içindeki resmî tatiller ayrıca listelenir ki proje planlama
 * ekranında (project-service, Day 6+) haftanın kaç iş günü içerdiği görülebilsin.
 *
 * NOT: Bu use-case `projectId` DEĞİL, `startDate` + `totalWeeks` alır — çünkü project_projects
 * tablosu project-service'e ait; integration-service KIRILMAZ KURAL gereği o tabloyu bilemez
 * (bkz. docs/roadmap.md Bölüm 2/2.1). project-service kendi bildiği başlangıç tarihini ve hafta
 * sayısını buraya parametre olarak gönderir. (Uzman inisiyatifi — CHANGELOG.md Day 3.)
 */
export async function calculateWeekDateRanges(
  startDate: string,
  totalWeeks: number,
  holidayRepo: HolidayRepository,
): Promise<WeekRange[]> {
  const ranges: WeekRange[] = [];
  let cursor = new Date(startDate);

  for (let week = 1; week <= totalWeeks; week++) {
    const weekStart = cursor;
    const weekEnd = addDays(weekStart, 6);
    const businessResult = await calculateBusinessDays(toIso(weekStart), toIso(weekEnd), holidayRepo);

    ranges.push({
      weekNo: week,
      startDate: toIso(weekStart),
      endDate: toIso(weekEnd),
      businessDays: businessResult.totalBusinessDays,
      excludedHolidayDates: businessResult.excludedHolidayDates,
    });

    cursor = addDays(weekEnd, 1);
  }

  return ranges;
}
