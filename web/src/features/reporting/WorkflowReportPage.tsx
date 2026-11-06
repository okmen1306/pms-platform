import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWorkflowStatus } from './reporting.api';
import { GanttChart } from './GanttChart';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * F1 (Day 12) + Day 13 güncellemesi: reporting-service'in `GET /reports/workflow`
 * (Day 21: spec adı; eski `workflow-status` alias'ı) uç noktasının ilk tüketicisi. Day 12'de iş paketi/personel ADLARI çözümlenmediği için ham
 * ID gösteriliyordu (bkz. eski not) — B1+B2'nin bugünkü desteğiyle backend artık isim de
 * döndürüyor; isim yoksa (servis anlık erişilemez/henüz atanmamış) ham ID'ye DÜŞÜLÜR, hiçbir
 * satır sessizce boş bırakılmaz.
 */
export function WorkflowReportPage() {
  const [projectId, setProjectId] = useState('');

  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['workflow-status', projectId],
    queryFn: () => fetchWorkflowStatus(projectId),
    enabled: !!projectId,
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">İş Akışı Raporu</h1>
      {/* Day 21 (F2): üstte Gantt görünümü, altta ayrıntı tablosu. */}

      <input
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="Proje ID'si"
        className="w-full max-w-md rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono"
      />

      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
      {isError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          İş akışı raporu getirilemedi.
        </p>
      )}

      {!isLoading && projectId && entries.length === 0 && (
        <EmptyState title="Henüz bir iş akışı kaydı yok" description="Bu projeye henüz personel ataması yapılmamış olabilir." />
      )}

      {entries.length > 0 && <GanttChart entries={entries} />}

      {entries.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-3 py-2 font-medium">İş Paketi</th>
                <th className="px-3 py-2 font-medium">Personel</th>
                <th className="px-3 py-2 font-medium">Başlangıç</th>
                <th className="px-3 py-2 font-medium">Bitiş</th>
                <th className="px-3 py-2 font-medium">Tamamlanma</th>
                <th className="px-3 py-2 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-gray-800 text-xs">
                    {e.workPackageName ?? <span className="font-mono">{e.workPackageId ?? '—'}</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-800 text-xs">
                    {e.employeeName ?? <span className="font-mono">{e.employeeId ?? '—'}</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{e.baslangicTarihi ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{e.bitisTarihi ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">%{e.tamamlanmaYuzdesi}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        e.durum === 'tamamlandi' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {e.durum === 'tamamlandi' ? 'Tamamlandı' : 'Devam Ediyor'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
