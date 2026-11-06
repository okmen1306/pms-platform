import { z } from 'zod';
export const ExchangeRateUpdatedEventSchema = z.object({
    date: z.string().date(),
    usdTry: z.number().positive(),
    source: z.string().default('TCMB'),
});
export const EXCHANGE_RATE_EVENTS = {
    UPDATED: 'exchange_rate.updated',
};
