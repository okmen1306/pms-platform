import { ServiceUnavailableError } from '@pms/shared';

export interface BusinessDaysResponse {
  totalCalendarDays: number;
  totalBusinessDays: number;
  excludedHolidayDates: string[];
}

/**
 * project-service, integration-service'in tablolarına ASLA doğrudan SQL ile dokunmaz
 * (KIRILMAZ KURAL, bkz. docs/roadmap.md Bölüm 2/2.1) — tek doğru kaynağa (tatil/iş günü
 * hesabı) her zaman bu REST istemcisi üzerinden ulaşır.
 */
export class IntegrationServiceClient {
  constructor(private readonly baseUrl: string) {}

  async getBusinessDays(start: string, end: string): Promise<BusinessDaysResponse> {
    const url = new URL('/business-days', this.baseUrl);
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ServiceUnavailableError('integration-service');
    }
    const body = (await response.json()) as any; // NOT (Day 7 Q): fetch tiplemesi Promise<unknown> döner
    return body.data as BusinessDaysResponse;
  }
}
