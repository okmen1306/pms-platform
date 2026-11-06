/**
 * TL <-> USD çevrimi için tek merkezi yardımcı. Kur DEĞERİ integration-service'ten gelir
 * (bkz. date.helper.ts'teki aynı prensip); bu fonksiyonlar sadece verilen kurla matematiği yapar.
 */
export function tlToUsd(amountTl: number, usdTryRate: number): number {
  if (usdTryRate <= 0) throw new Error('usdTryRate 0 veya negatif olamaz');
  return Math.round((amountTl / usdTryRate) * 100) / 100;
}

export function usdToTl(amountUsd: number, usdTryRate: number): number {
  if (usdTryRate <= 0) throw new Error('usdTryRate 0 veya negatif olamaz');
  return Math.round(amountUsd * usdTryRate * 100) / 100;
}

export function formatTl(amount: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
