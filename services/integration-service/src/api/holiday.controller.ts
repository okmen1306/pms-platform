import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList } from '@pms/shared';
import type { HolidayRepository } from '../infrastructure/database/holiday.repository';

const CreateHolidayBodySchema = z.object({
  tarih: z.string().date(),
  aciklama: z.string().min(1),
  yarimGun: z.boolean().optional(),
});

export function registerHolidayRoutes(app: FastifyInstance, deps: { holidayRepo: HolidayRepository }) {
  app.get('/holidays', async (request) => {
    const { year } = z.object({ year: z.coerce.number().int() }).parse(request.query);
    const items = await deps.holidayRepo.findByYear(year);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/holidays', async (request) => {
    // RBAC (Day 21, G-01): gateway'de `integration.holidays` edit ile zorlanır (yalnızca sirket_yoneticisi).
    const body = CreateHolidayBodySchema.parse(request.body);
    const created = await deps.holidayRepo.create(body);
    return ok(created);
  });
}
