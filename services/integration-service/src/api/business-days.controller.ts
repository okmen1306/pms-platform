import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList } from '@pms/shared';
import { calculateBusinessDays } from '../core/use-cases/calculate-business-days.usecase';
import { calculateWeekDateRanges } from '../core/use-cases/calculate-week-date-ranges.usecase';
import type { HolidayRepository } from '../infrastructure/database/holiday.repository';

/**
 * "Takvim hesaplama" sorumluluk alanı: iş günü sayımı + haftalık tarih aralıkları aynı
 * dosyada tutuluyor (ikisi de aynı business logic'i — resmî tatil düşme — paylaşıyor).
 */
export function registerBusinessDaysRoutes(app: FastifyInstance, deps: { holidayRepo: HolidayRepository }) {
  app.get('/business-days', async (request) => {
    const { start, end } = z
      .object({ start: z.string().date(), end: z.string().date() })
      .parse(request.query);
    const result = await calculateBusinessDays(start, end, deps.holidayRepo);
    return ok(result);
  });

  /**
   * Uzman inisiyatifi (bkz. CHANGELOG.md Day 3): orijinal API şartnamesinde bu endpoint
   * `?projectId=` alıyordu; ancak integration-service KIRILMAZ KURAL gereği project-service'in
   * tablosunu bilemez. Bunun yerine project-service'in zaten sahip olduğu `startDate` ve
   * `totalWeeks` değerlerini doğrudan alır.
   */
  app.get('/week-ranges', async (request) => {
    const { startDate, totalWeeks } = z
      .object({ startDate: z.string().date(), totalWeeks: z.coerce.number().int().positive() })
      .parse(request.query);
    const items = await calculateWeekDateRanges(startDate, totalWeeks, deps.holidayRepo);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });
}
