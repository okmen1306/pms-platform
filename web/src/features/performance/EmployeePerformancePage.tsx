import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCriteria, fetchEmployeeScores } from './performance.api';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * F2 (Day 10): "Performance tamamlama" (docs/roadmap.md Bölüm 14.3 satır 10). ScoringForm
 * (Day 9) puan GİRER, bu sayfa GÖRÜNTÜLER — aynı kriter kataloğunu paylaşır. Kalıcı bir
 * navigasyon kabuğu/proje-personel seçici henüz yok (Day 18+, bkz. CostAnalysisPage.tsx'teki
 * AYNI not) — ID'ler elle girilir.
 */
export function EmployeePerformancePage() {
  const [projectId, setProjectId] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const { data: criteria = [] } = useQuery({ queryKey: ['performance-criteria'], queryFn: fetchCriteria });
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['employee-scores', projectId, employeeId],
    queryFn: () => fetchEmployeeScores(projectId, employeeId),
    enabled: !!projectId && !!employeeId,
  });

  const criterionNameById = useMemo(() => new Map(criteria.map((c) => [c.id, c.ad])), [criteria]);
  const ortalama = scores.length > 0 ? Math.round((scores.reduce((sum, s) => sum + Number(s.puan), 0) / scores.length) * 100) / 100 : null;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Personel Performansı</h1>

      <div className="grid grid-cols-2 gap-3 max-w-lg">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Proje ID</label>
          <input value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Personel ID</label>
          <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      {projectId && employeeId && (
        <>
          {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}

          {!isLoading && scores.length === 0 && (
            <EmptyState title="Henüz puanlanmamış" description="Bu personel bu projede henüz hiçbir kritere göre puanlanmadı." />
          )}

          {scores.length > 0 && (
            <>
              <div className="bg-white rounded-lg border border-gray-200 p-4 max-w-xs">
                <p className="text-xs text-gray-500">Ortalama Puan</p>
                <p className="text-2xl font-semibold text-gray-900">{ortalama}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 max-w-lg">
                {scores.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">{criterionNameById.get(s.criterion_id) ?? s.criterion_id}</span>
                    <span className="text-sm font-medium text-gray-900">{s.puan}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
