import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchCriteria, submitEmployeeScore } from './performance.api';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * F2 (Day 9): "Performance modülü: ScoringForm" (docs/roadmap.md Bölüm 14.3 satır 9).
 *
 * Kalıcı bir navigasyon kabuğu/proje seçici henüz yok (Day 18+'da eklenecek, bkz.
 * CostAnalysisPage.tsx'teki AYNI not) — bu yüzden proje/personel ID'leri CostAnalysisPage'deki
 * İLE AYNI desenle elle girilir.
 *
 * Backend'in `POST /projects/:id/employees/:id/scores` uç noktası TEK BİR kriter puanlar
 * (bkz. performance.controller.ts) — bu form TÜM aktif kriterleri listeler, her biri için ayrı
 * bir puan alanı sunar ve "Tümünü Kaydet" ile hepsini paralel gönderir (backend zaten
 * `onConflict: 'project_id,employee_id,criterion_id'` ile upsert yapıyor, bu yüzden formu
 * yeniden göndermek güvenlidir).
 *
 * `RoleGuard` İLE SARILMADI (CostAnalysisPage'in aksine) — çünkü api-gateway'in
 * `/performance/*` proxy'si (performance.routes.ts) şu an sadece genel kimlik doğrulama
 * istiyor, `finance.cost_analysis` gibi özel bir izin YOK; olmayan bir yetki sınırını UI'da
 * simüle etmek yanıltıcı olurdu.
 */
export function ScoringForm() {
  const [projectId, setProjectId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const { data: criteria = [], isLoading } = useQuery({ queryKey: ['performance-criteria'], queryFn: fetchCriteria });
  const toplamAgirlik = criteria.reduce((sum, c) => sum + Number(c.agirlik_yuzdesi), 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(scores).filter(([, puan]) => puan !== undefined && puan !== null);
      await Promise.all(entries.map(([criterionId, puan]) => submitEmployeeScore(projectId, employeeId, criterionId, puan)));
    },
    onSuccess: () => setSavedMessage('Puanlar kaydedildi.'),
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Personel Puanlama</h1>

      <div className="grid grid-cols-2 gap-3 max-w-lg">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Proje ID</label>
          <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="uuid" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Personel ID</label>
          <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="uuid" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      {isLoading && <p className="text-xs text-gray-500">Kriterler yükleniyor...</p>}

      {!isLoading && criteria.length === 0 && (
        <EmptyState title="Henüz kriter tanımlanmamış" description="Puanlama yapılabilmesi için önce en az bir performans kriteri oluşturulmalı." />
      )}

      {criteria.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 max-w-lg">
          {criteria.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm text-gray-800">{c.ad}</p>
                <p className="text-xs text-gray-400">Ağırlık: %{c.agirlik_yuzdesi}</p>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                value={scores[c.id] ?? ''}
                onChange={(e) => setScores((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-right"
              />
            </div>
          ))}
          {toplamAgirlik !== 100 && (
            <p className="text-xs text-amber-600 px-4 py-2">
              ⚠ Aktif kriterlerin toplam ağırlığı %{toplamAgirlik} — %100 olması beklenir (bilgilendirme amaçlı, kayıt engellenmez).
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={!projectId || !employeeId || Object.keys(scores).length === 0 || mutation.isPending}
        className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
      >
        Tümünü Kaydet
      </button>
      {savedMessage && <p className="text-xs text-green-700">{savedMessage}</p>}
      {mutation.isError && (
        <p className="text-xs text-red-600">{mutation.error instanceof Error ? mutation.error.message : 'Puanlar kaydedilemedi'}</p>
      )}
    </div>
  );
}
