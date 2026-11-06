import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMaterials, type Material } from './procurement.api';
import { DataTable, type DataTableColumn } from '../../shared/components/DataTable';
import { CurrencyBadge } from '../../shared/components/CurrencyBadge';
import { MaterialFormPage } from './MaterialFormPage';
import { MaterialStockPanel } from './MaterialStockPanel';

/**
 * Day 4: proje seçimi henüz project-service'ten gelmiyor — geçici manuel ID girişi (Day 6+'da
 * ProjectContext'ten otomatik alınacak).
 * Day 5: her satıra "Stok" butonu eklendi — B2'nin bugün tamamladığı stok hareketleri
 * endpoint'ine bağlı `MaterialStockPanel` seçili malzeme için açılıyor.
 */
export function MaterialListPage() {
  const [projectId, setProjectId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);

  const { data: materials = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['materials', projectId],
    queryFn: () => fetchMaterials(projectId),
    enabled: !!projectId,
  });

  const columns: DataTableColumn<Material>[] = [
    { key: 'malzeme_adi', header: 'Malzeme', render: (m) => m.malzeme_adi },
    { key: 'malzeme_turu', header: 'Tür', render: (m) => m.malzeme_turu },
    { key: 'adet', header: 'Adet', render: (m) => String(m.adet) },
    { key: 'toplam', header: 'Toplam', render: (m) => <CurrencyBadge amountTl={m.toplam_tl} amountUsd={m.toplam_usd} /> },
    { key: 'tarih', header: 'Alım Tarihi', render: (m) => m.alim_tarihi },
    {
      key: 'stok',
      header: '',
      render: (m) => (
        <button
          onClick={() => setSelectedMaterialId(m.id === selectedMaterialId ? null : m.id)}
          className="text-xs text-blue-600 hover:underline"
        >
          Stok
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Satın Alma</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5"
        >
          {showForm ? 'Kapat' : '+ Malzeme Ekle'}
        </button>
      </div>

      <input
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="Proje ID'si (Day 6+'da proje seçici ile değişecek)"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
      />

      {showForm && (
        <MaterialFormPage
          projectId={projectId}
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      {isError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          Malzeme listesi alınamadı. procurement-service'in ayakta olduğundan emin olun.
        </p>
      )}

      {projectId && !isError && (
        <DataTable
          columns={columns}
          rows={materials}
          rowKey={(m) => m.id}
          isLoading={isLoading}
          emptyTitle="Bu projede henüz malzeme yok"
        />
      )}

      {selectedMaterialId && (
        <MaterialStockPanel materialId={selectedMaterialId} onClose={() => setSelectedMaterialId(null)} />
      )}
    </div>
  );
}
