import { XMLParser } from 'fast-xml-parser';
import { ExchangeRateUnavailableError } from '@pms/shared';

export interface TcmbRateResult {
  tarih: string;   // ISO date (bugünün tarihi)
  usdTry: number;
}

export interface TcmbAdapter {
  fetchTodayRate(): Promise<TcmbRateResult>;
}

interface TcmbXmlShape {
  Tarih_Date: {
    Currency: Array<{ CurrencyCode: string; ForexSelling?: number | string }> | { CurrencyCode: string; ForexSelling?: number | string };
  };
}

/**
 * Day 2: gerçek implementasyon. TCMB günlük kur XML'inden USD ForexSelling (efektif satış)
 * kurunu okur. TCMB satışa kapalı günlerde (hafta sonu/resmi tatil) o günün XML'ini yayınlamaz;
 * bu durumda ExchangeRateUnavailableError fırlatılır ve cron bir önceki güne kadar geriye bakar
 * (bkz. fetch-tcmb-rate.usecase.ts).
 */
export class TcmbHttpAdapter implements TcmbAdapter {
  private readonly parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

  constructor(private readonly xmlUrl: string) {}

  async fetchTodayRate(): Promise<TcmbRateResult> {
    const response = await fetch(this.xmlUrl);
    if (!response.ok) {
      throw new ExchangeRateUnavailableError(new Date().toISOString().slice(0, 10));
    }
    const xmlText = await response.text();
    const parsed = this.parser.parse(xmlText) as TcmbXmlShape;

    const currencies = Array.isArray(parsed.Tarih_Date.Currency)
      ? parsed.Tarih_Date.Currency
      : [parsed.Tarih_Date.Currency];

    const usd = currencies.find((c) => c.CurrencyCode === 'USD');
    if (!usd || usd.ForexSelling === undefined || usd.ForexSelling === '') {
      throw new ExchangeRateUnavailableError(new Date().toISOString().slice(0, 10));
    }

    return {
      tarih: new Date().toISOString().slice(0, 10),
      usdTry: Number(usd.ForexSelling),
    };
  }
}
