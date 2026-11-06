import { ExchangeRateUnavailableError } from '@pms/shared';

/**
 * procurement-service, integration-service'in tablosuna ASLA doğrudan dokunmaz — güncel/geçmiş
 * kur bilgisini her zaman bu REST istemcisi üzerinden alır (KIRILMAZ KURAL, Bölüm 2/2.1).
 */
export class IntegrationServiceClient {
  constructor(private readonly baseUrl: string) {}

  async getRateForDate(date: string): Promise<number> {
    const response = await fetch(new URL(`/exchange-rate/${date}`, this.baseUrl));
    if (!response.ok) {
      throw new ExchangeRateUnavailableError(date);
    }
    const body = (await response.json()) as any; // NOT (Day 8 Q, tam derleme taraması — bkz. project-service'in aynı istemcisindeki Day 7 notu): fetch tiplemesi Promise<unknown> döner
    return Number(body.data.usdTry);
  }
}
