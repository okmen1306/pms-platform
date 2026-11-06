import { useExchangeRate, tlToUsd } from '../hooks/useExchangeRate';

interface CurrencyBadgeProps {
  amountTl: number;
  amountUsd?: number;
  showUsd?: boolean;
  /**
   * Day 20: `amountUsd` yoksa USD'yi GÜNCEL kurla tahmin et (örn. henüz kaydedilmemiş bir giriş
   * önizlemesi). Gerçekleşmiş maliyetlerde KULLANMA — onların USD'si kayıt anındaki kurla
   * hesaplanıp backend'de saklanır; güncel kurla yeniden çevirmek yanıltıcı olur.
   */
  estimateUsdWithCurrentRate?: boolean;
}

/**
 * Kural #5 (docs/roadmap.md): maaş/maliyet TL girilir, hesaplamalarda güncel kur ile USD'ye
 * çevrilir. Bu bileşen HER ZAMAN TL'yi birincil gösterir, USD'yi parantez içinde ikincil olarak
 * — Excel prototipindeki alışkanlığı bozmamak için (bkz. docs/roadmap.md Bölüm 1 vizyon notu).
 *
 * Day 2: statik formatlama. `amountUsd` verilmezse sadece TL gösterir. Day 20: isteğe bağlı
 * `estimateUsdWithCurrentRate` ile güncel kurdan tahmini USD (bkz. useExchangeRate.ts).
 */
export function CurrencyBadge({ amountTl, amountUsd, showUsd = true, estimateUsdWithCurrentRate = false }: CurrencyBadgeProps) {
  const rate = useExchangeRate({ enabled: estimateUsdWithCurrentRate && amountUsd === undefined });
  const effectiveUsd = amountUsd ?? (estimateUsdWithCurrentRate ? tlToUsd(amountTl, rate.data?.usdTry) ?? undefined : undefined);
  const tlFormatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amountTl);
  const usdFormatted =
    effectiveUsd !== undefined
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(effectiveUsd)
      : null;

  return (
    <span className="inline-flex items-baseline gap-1 font-medium text-gray-900">
      <span>{tlFormatted}</span>
      {showUsd && usdFormatted && <span className="text-xs text-gray-400">({usdFormatted})</span>}
    </span>
  );
}
