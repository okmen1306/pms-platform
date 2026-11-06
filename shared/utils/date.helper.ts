/**
 * Bu dosya, tarih/iş günü hesaplamasının TEK doğru kaynağının integration-service olduğu
 * kuralını (roadmap.md Bölüm 2 Kırılmaz Kural) kod seviyesinde hatırlatır: burada hesaplama
 * YAPILMAZ, sadece integration-service'e REST çağrısı yapan servislerin ortak arayüzü tanımlanır.
 * Her servis kendi tatil/iş günü mantığını yeniden yazarsa Kural #ihlali olur.
 */

export interface BusinessDaysResult {
  totalCalendarDays: number;
  totalBusinessDays: number;
  excludedHolidayDates: string[]; // ISO date string listesi
}

export interface WeekRange {
  weekNo: number;
  startDate: string; // ISO date
  endDate: string;   // ISO date
}

/** integration-service GET /business-days?start=&end= çağrısının response tipi */
export type BusinessDaysClient = (start: string, end: string) => Promise<BusinessDaysResult>;

/** integration-service GET /week-ranges?projectId= çağrısının response tipi */
export type WeekRangesClient = (projectId: string) => Promise<WeekRange[]>;
