import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStockMovements, createStockMovement } from './procurement.api';

/**
 * Day 5: B2'nin bugün tamamladığı stok hareketleri endpoint'ine bağlanan panel.
 * docs/roadmap.md Bölüm 18 kuralı: yükleniyor/boş/hata durumları eksiksiz gösterilir.
 */
export function MaterialStockPanel({ materialId, onClose }: { materialId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [miktar, setMiktar] = useState('');
  const [tip, setTip] = useState<'giris' | 'cikis'>('giris');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stock-movements', materialId],
    queryFn: () => fetchStockMovements(materialId),
  });

  const mutation = useMutation({
    mutationFn: () => createStockMovement(materialId, tip, Number(miktar)),
    onSuccess: () => {
      setMiktar('');
      queryClient.invalidateQueries({ queryKey: ['stock-movements', materialId] });
    },
  });

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Stok Hareketleri</h3>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">
          Kapat
        </button>
      </div>

      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
      {isError && <p className="text-xs text-red-600">Stok hareketleri alınamadı.</p>}

      {data && (
        <>
          <p className="text-sm font-medium text-gray-700">
            Mevcut Stok: <span className="text-gray-900">{data.currentStock}</span>
          </p>

          {data.items.length === 0 ? (
            <p className="text-xs text-gray-500">Henüz hareket kaydı yok.</p>
          ) : (
            <ul className="text-xs divide-y divide-gray-200">
              {data.items.map((m) => (
                <li key={m.id} className="py-1.5 flex justify-between">
                  <span className={m.hareket_tipi === 'giris' ? 'text-green-700' : 'text-red-700'}>
                    {m.hareket_tipi === 'giris' ? '+ Giriş' : '- Çıkış'}: {m.miktar}
                  </span>
                  <span className="text-gray-400">{new Date(m.created_at).toLocaleDateString('tr-TR')}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <select
              value={tip}
              onChange={(e) => setTip(e.target.value as 'giris' | 'cikis')}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
            >
              <option value="giris">Giriş</option>
              <option value="cikis">Çıkış</option>
            </select>
            <input
              type="number"
              value={miktar}
              onChange={(e) => setMiktar(e.target.value)}
              placeholder="Miktar"
              className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs"
            />
            <button
              onClick={() => mutation.mutate()}
              disabled={!miktar || mutation.isPending}
              className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Ekle
            </button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600">
              {mutation.error instanceof Error ? mutation.error.message : 'Hareket kaydedilemedi'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
