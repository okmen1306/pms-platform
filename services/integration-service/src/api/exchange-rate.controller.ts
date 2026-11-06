import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NotFoundError, ok } from '@pms/shared';
import type { ExchangeRateRepository } from '../infrastructure/database/exchange-rate.repository';

export function registerExchangeRateRoutes(app: FastifyInstance, deps: { exchangeRateRepo: ExchangeRateRepository }) {
  app.get('/exchange-rate/current', async () => {
    const latest = await deps.exchangeRateRepo.findLatest();
    if (!latest) throw new NotFoundError('Kur kaydı', 'current');
    return ok(latest);
  });

  app.get('/exchange-rate/:date', async (request) => {
    const { date } = z.object({ date: z.string().date() }).parse(request.params);
    const rate = await deps.exchangeRateRepo.findByDate(date);
    if (!rate) throw new NotFoundError('Kur kaydı', date);
    return ok(rate);
  });
}
