import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_KEYS } from '@pms/shared';
import { fetchProjectCost } from './finance.api';
import { RoleGuard } from '../../shared/components/RoleGuard';
import { CurrencyBadge } from '../../shared/components/CurrencyBadge';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * Day 6: iskelet ekran olarak başladı. Kural (docs/roadmap.md "Önemli Not" — maliyet analizi
 * bölümü): bu sayfayı SADECE Şirket Yöneticisi görebilir. `RoleGuard` ile TÜM sayfa sarmalanıyor —
 * yetkisi olmayan kullanıcı hiçbir şey görmez (Bölüm 18 kuralı: tamamen gizle, kilit ikonu değil).
 * F2 (Day 8): kalem bazlı döküm eklendi (AR-GE/malzeme/danışmanlık/paketleme/diğer/idari).
 * Day 9: idari maliyet tutarı + kâr marjı hesaplaması finance-service'te tamamlandı (bkz.
 * cost.repository.ts recalculateCostRollup) — bu sayfa artık gerçek değerler gösteriyor.
 */
export function CostAnalysisPage() {
  const [projectId, setProjectId] = useState('');

  const { data: cost, isLoading, isError } = useQuery({
    queryKey: ['project-cost', projectId],
    queryFn: () => fetchProjectCost(projectId),
    enabled: !!projectId,
  });

  return (
    <RoleGuard
      permissionKey={PERMISSION_KEYS.FINANCE_COST_ANALYSIS}
      fallback={
        <div className="p-6">
          <EmptyState title="Bu sayfayı görüntüleme yetkiniz yok" description="Maliyet analizi yalnızca şirket yöneticisine açıktır." />
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">Maliyet Analizi</h1>

        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Proje ID'si"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        />

        {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
        {isError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            Maliyet kaydı bulunamadı. Proje henüz oluşturulmamış olabilir (finance-service, proje
            oluşturulduğunda otomatik bir maliyet iskeleti açar).
          </p>
        )}

        {cost && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Tahmini Maliyet</p>
                <CurrencyBadge amountTl={cost.toplam_tahmini_maliyet_tl} showUsd={false} />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Gerçekleşen Maliyet</p>
                <CurrencyBadge amountTl={cost.toplam_gerceklesen_maliyet_tl} showUsd={false} />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Fark</p>
                <CurrencyBadge amountTl={cost.fark_tl} showUsd={false} />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Kâr Marjı</p>
                <p className="text-sm font-medium text-gray-900">
                  {cost.kar_marji_yuzde !== null ? `%${cost.kar_marji_yuzde}` : 'Henüz hesaplanmadı'}
                </p>
              </div>
            </div>

            {/*
              F2 (Day 8 — "finance modülü tamamlama"): gerçekleşen maliyetin KALEM BAZLI dökümü.
              Önceden sayfa sadece tek bir "Gerçekleşen Maliyet" sayısı gösteriyordu — bu, B2'nin
              bugün eklediği malzeme maliyeti dahil hiçbir bileşenin AYRI AYRI görünmemesi
              anlamına geliyordu. `idari_maliyet_tutari_tl`, `danismanlik_maliyeti_tl` ve
              `paketleme_maliyeti_tl` bugün itibarıyla hâlâ sıfır olabilir (bunlar Day 9'un
              kapsamı, bkz. docs/roadmap.md Bölüm 14.2 Day 9 satırı) — bilinçli olarak yine de
              listede gösteriliyor ki kalem listesi Day 9'da sessizce "ortaya çıkmasın".
            */}
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              <p className="text-xs font-medium text-gray-500 px-4 py-2">Maliyet Kalemleri</p>
              {[
                { label: 'AR-GE Maliyeti', tl: cost.arge_maliyeti_tl, usd: cost.arge_maliyeti_usd },
                { label: 'Malzeme Maliyeti', tl: cost.malzeme_maliyeti_tl, usd: cost.malzeme_maliyeti_usd },
                { label: 'Danışmanlık Maliyeti', tl: cost.danismanlik_maliyeti_tl },
                { label: 'Paketleme Maliyeti', tl: cost.paketleme_maliyeti_tl },
                { label: 'Diğer Maliyetler', tl: cost.diger_maliyetler_toplam_tl },
                { label: 'İdari Maliyet Payı', tl: cost.idari_maliyet_tutari_tl },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <CurrencyBadge amountTl={item.tl} amountUsd={item.usd} showUsd={item.usd !== undefined} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
