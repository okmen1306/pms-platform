import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWorkDetail } from './reporting.api';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * F1 (Day 13): "Reports: WorkDetailPage" — `GET /reports/work-detail`'in ilk tüketicisi.
 * WorkflowReportPage'in (Day 12) BAŞLANGIÇTA ham ID gösterip Day 13'te isme çevrildiği AYNI
 * geçişi burada baştan itibaren doğru kuruyoruz: isim yoksa (personnel/project-service anlık
 * erişilemez) ham ID'ye düşülür, hiçbir satır sessizce eksik bırakılmaz.
 */
export function WorkDetailPage() {
  const [projectId, setProjectId] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['work-detail', projectId],
    queryFn: () => fetchWorkDetail(projectId),
    enabled: !!projectId,
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">İş Detayı (Personel × Hafta)</h1>

      <input
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="Proje ID'si"
        className="w-full max-w-md rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono"
      />

      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
      {isError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          İş detay raporu getirilemedi. Proje henüz oluşturulmamış olabilir.
        </p>
      )}

      {data && data.length === 0 && (
        <EmptyState title="Henüz atama yok" description="Bu proje için iş paketi/personel ataması bulunamadı." />
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((entry) => (
            <div key={entry.workPackageId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-900">
                  {entry.workPackageName ?? <span className="font-mono text-gray-700">{entry.workPackageId}</span>}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 text-left">
                    <th className="px-4 py-2 font-normal">Personel</th>
                    <th className="px-4 py-2 font-normal">Hafta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entry.haftalar.map((h, i) => (
                    <tr key={`${h.employeeId}-${h.haftaNo}-${i}`}>
                      <td className="px-4 py-1.5 text-gray-800">
                        {h.employeeName ?? <span className="font-mono text-xs">{h.employeeId}</span>}
                      </td>
                      <td className="px-4 py-1.5 text-gray-600">{h.haftaNo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
