import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCompletionStatus, type CompletionScope } from './reporting.api';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * F1 (Day 12): "Reports: CompletionStatusPage" — reporting-service'in `GET /reports/completion-
 * status` uç noktasının (B3, Day 11) İLK tüketicisi. `scope=project` tek bir özet nesne,
 * `scope=work-package`/`employee` bir dizi döner (bkz. reporting.api.ts) — bu yüzden iki farklı
 * render dalı var.
 */
const SCOPES: { value: CompletionScope; label: string }[] = [
  { value: 'project', label: 'Proje Geneli' },
  { value: 'work-package', label: 'İş Paketine Göre' },
  { value: 'employee', label: 'Personele Göre' },
];

export function CompletionStatusPage() {
  const [projectId, setProjectId] = useState('');
  const [scope, setScope] = useState<CompletionScope>('project');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['completion-status', projectId, scope],
    queryFn: () => fetchCompletionStatus(projectId, scope),
    enabled: !!projectId,
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Tamamlanma Durumu</h1>

      <input
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="Proje ID'si"
        className="w-full max-w-md rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono"
      />

      {projectId && (
        <div className="flex gap-2">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => setScope(s.value)}
              className={`text-xs rounded-full px-3 py-1 border ${
                scope === s.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
      {isError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          Tamamlanma verisi getirilemedi. Proje henüz oluşturulmamış olabilir.
        </p>
      )}

      {data && !Array.isArray(data) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 max-w-sm space-y-2">
          <p className="text-sm font-medium text-gray-900">{data.projeAdi}</p>
          <p className="text-3xl font-semibold text-gray-900">%{data.tamamlanmaYuzdesi}</p>
          <p className="text-xs text-gray-500">
            {data.tamamlananIsSayisi} / {data.toplamIsSayisi} atama tamamlandı
          </p>
        </div>
      )}

      {data && Array.isArray(data) && data.length === 0 && (
        <EmptyState title="Henüz veri yok" description="Bu proje için tamamlanma kaydı bulunamadı." />
      )}

      {data && Array.isArray(data) && data.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {data.map((entry) => (
            <div key={entry.key} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-700 font-mono">{entry.key}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {entry.tamamlananIsSayisi} / {entry.toplamIsSayisi}
                </span>
                <span className="text-sm font-medium text-gray-900">%{entry.tamamlanmaYuzdesi}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
