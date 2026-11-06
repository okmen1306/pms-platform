import { ServiceUnavailableError } from '@pms/shared';

export interface WeekRangeResponse {
  weekNo: number;
  startDate: string;
  endDate: string;
  businessDays: number;
  excludedHolidayDates: string[];
}

/**
 * finance-service, "hangi takvim tarihi hangi hafta numarasına denk geliyor" hesaplamasını
 * ASLA kendisi yapmaz — bu, integration-service'in TEK doğru kaynağı olduğu bir hesaplama
 * (bkz. shared/utils/date.helper.ts başlığı, KIRILMAZ KURAL). AR-GE maliyeti hesabı
 * (calculate-arge-cost.usecase.ts) proje haftalarını ve güncel USD/TRY kurunu hep buradan alır.
 */
export class IntegrationServiceClient {
  constructor(private readonly baseUrl: string) {}

  async getWeekRanges(startDate: string, totalWeeks: number): Promise<WeekRangeResponse[]> {
    const url = new URL('/week-ranges', this.baseUrl);
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('totalWeeks', String(totalWeeks));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ServiceUnavailableError('integration-service');
    }
    const body = (await response.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
    return body.data as WeekRangeResponse[];
  }

  async getCurrentUsdTryRate(): Promise<number> {
    const response = await fetch(new URL('/exchange-rate/current', this.baseUrl));
    if (!response.ok) {
      throw new ServiceUnavailableError('integration-service');
    }
    const body = (await response.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
    return Number(body.data.usdTry);
  }
}
