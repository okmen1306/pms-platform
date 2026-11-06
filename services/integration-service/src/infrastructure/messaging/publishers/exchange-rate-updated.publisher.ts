import { RabbitMqClient, EXCHANGE_RATE_EVENTS, ExchangeRateUpdatedEventSchema } from '@pms/shared';

export function createExchangeRateUpdatedPublisher(rabbit: RabbitMqClient) {
  return async (event: { date: string; usdTry: number; source: string }) => {
    const parsed = ExchangeRateUpdatedEventSchema.parse(event);
    await rabbit.publish(EXCHANGE_RATE_EVENTS.UPDATED, parsed);
  };
}
