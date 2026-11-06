import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';

export interface ExchangeRate {
  tarih: string;
  usdTry: number;
}

/**
 * Day 20: integration-service'in güncel USD/TRY kuru (`GET /integration/exchange-rate/current`).
 * Kural #5: maliyetler TL girilir, USD karşılığı GÜNCEL kurla gösterilir. Kur yoksa (henüz TCMB
 * kaydı yok → 404) sayfa kırılmaz: `data` undefined kalır ve çağıran USD önizlemesini gizler.
 */
export function useExchangeRate(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['exchange-rate', 'current'],
    queryFn: () => apiFetch<ExchangeRate>('/integration/exchange-rate/current', { fallbackError: 'Güncel kur alınamadı' }),
    enabled: options.enabled ?? true,
    staleTime: 60 * 60 * 1000, // kur günde bir güncellenir (TCMB cron)
    retry: false,
  });
}

/** TL → USD (2 ondalık). `usdTry` ≤ 0 veya geçersizse `null` — yanlış/sonsuz değer gösterilmez. */
export function tlToUsd(amountTl: number, usdTry: number | undefined): number | null {
  if (!usdTry || !Number.isFinite(usdTry) || usdTry <= 0 || !Number.isFinite(amountTl)) return null;
  return Math.round((amountTl / usdTry) * 100) / 100;
}
