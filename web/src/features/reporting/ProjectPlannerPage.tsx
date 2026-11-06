import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProjectPlanner } from './reporting.api';

/**
 * F1 (Day 13): "Reports: ProjectPlannerPage" — `GET /reports/project-planner`'ın ilk tüketicisi.
 * Snapshot HER ZAMAN `planlanan_*` alanlarıyla `project.created` anında açılır (bkz. record-
 * project-planner-snapshot.usecase.ts) — bu yüzden 404, "proje yok" ile "event henüz işlenmedi"
 * arasında AYIRT EDİLEMEZ (RabbitMQ tüketimi asenkron); sayfa bunu DÜRÜSTÇE tek bir mesajla
 * gösterir, birini diğerinden daha olası gibi sunmaz.
 */
export function ProjectPlannerPage() {
  const [projectId, setProjectId] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-planner', projectId],
    queryFn: () => fetchProjectPlanner(projectId),
    enabled: !!projectId,
    retry: false,
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Proje Planlayıcı</h1>

      <input
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="Proje ID'si"
        className="w-full max-w-md rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono"
      />

      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
      {isError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          Bu proje için planlayıcı verisi bulunamadı — proje henüz oluşturulmamış OLABİLİR veya
          oluşturma olayı henüz işlenmemiş olabilir (kısa bir gecikme sonra tekrar deneyin).
        </p>
      )}

      {data && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 max-w-lg space-y-4">
          <p className="text-base font-medium text-gray-900">{data.projeAdi}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Planlanan Başlangıç</p>
              <p className="text-sm text-gray-800">{data.planlananBaslangic ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fiili Başlangıç</p>
              <p className="text-sm text-gray-800">{data.fiiliBaslangic ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Planlanan Süre</p>
              <p className="text-sm text-gray-800">{data.planlananSureHafta != null ? `${data.planlananSureHafta} hafta` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fiili Süre</p>
              <p className="text-sm text-gray-800">{data.fiiliSureHafta != null ? `${data.fiiliSureHafta} hafta` : '—'}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Tamamlanma</p>
            <p className="text-2xl font-semibold text-gray-900">%{data.tamamlanmaYuzdesi ?? 0}</p>
          </div>
        </div>
      )}
    </div>
  );
}
