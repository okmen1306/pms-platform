import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_KEYS } from '@pms/shared';
import { fetchPersonnelWeeklyCost } from './finance.api';
import { RoleGuard } from '../../shared/components/RoleGuard';
import { CurrencyBadge } from '../../shared/components/CurrencyBadge';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * F2 (Day 7): AR-GE maliyeti haftalık dökümü (bkz. finance-service calculate-arge-cost.usecase.ts).
 * `ayni_hafta_proje_sayisi > 1` olan satırlar sarı rozetle işaretlenir — Kural #10'un
 * ("aynı hafta birden fazla projede görevliyse maliyet bölünür") kullanıcıya GÖRÜNÜR kılınması,
 * yoksa "neden bu haftanın maliyeti düşük?" sorusu şeffaf olmaz.
 *
 * CostAnalysisPage ile aynı desen: sayfa tamamen `RoleGuard` ile sarmalı (Kural — maliyet
 * analizini sadece Şirket Yöneticisi görebilir).
 */
export function ArgeCostPage() {
  const [projectId, setProjectId] = useState('');

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['arge-cost', projectId],
    queryFn: () => fetchPersonnelWeeklyCost(projectId),
    enabled: !!projectId,
  });

  const totalTl = rows.reduce((sum, r) => sum + Number(r.haftalik_maliyet_tl), 0);
  const totalUsd = rows.reduce((sum, r) => sum + Number(r.haftalik_maliyet_usd), 0);

  return (
    <RoleGuard
      permissionKey={PERMISSION_KEYS.FINANCE_COST_ANALYSIS}
      fallback={
        <div className="p-6">
          <EmptyState title="Bu sayfayı görüntüleme yetkiniz yok" description="AR-GE maliyeti yalnızca şirket yöneticisine açıktır." />
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">AR-GE Maliyeti (Haftalık)</h1>

        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Proje ID'si"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        />

        {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
        {isError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            Maliyet dökümü alınamadı. Projeye henüz personel atanmamış olabilir.
          </p>
        )}

        {!isLoading && !isError && projectId && rows.length === 0 && (
          <EmptyState title="Henüz AR-GE maliyeti yok" description="Bu projeye personel atandığında haftalık maliyet burada görünecek." />
        )}

        {rows.length > 0 && (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
              <span className="text-xs text-gray-500">Toplam AR-GE Maliyeti</span>
              <CurrencyBadge amountTl={totalTl} amountUsd={totalUsd} />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {rows
                .sort((a, b) => a.hafta_no - b.hafta_no)
                .map((row) => (
                  <div key={row.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm text-gray-800">
                        Hafta {row.hafta_no} <span className="text-xs text-gray-400">({row.hafta_baslangic_tarihi})</span>
                      </p>
                      <p className="text-xs text-gray-400 font-mono">{row.employee_id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.ayni_hafta_proje_sayisi > 1 && (
                        <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                          {row.ayni_hafta_proje_sayisi} projede bölündü
                        </span>
                      )}
                      <CurrencyBadge amountTl={row.haftalik_maliyet_tl} amountUsd={row.haftalik_maliyet_usd} />
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
