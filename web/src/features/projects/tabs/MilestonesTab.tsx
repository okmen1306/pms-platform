import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMilestones, createMilestone } from '../project.api';
import { EmptyState } from '../../../shared/components/EmptyState';

/**
 * F1 (Day 9): "MilestonesTab" (docs/roadmap.md Bölüm 14.3 satır 9) — B1'in bugün eklediği
 * `project_milestones`in UI'ı. AssignmentsTab (Day 8) İLE AYNI form + liste deseni.
 * `email_gonderilsin`/`hedef_gruplar` alanları backend'de zaten var (bkz. milestone.repository.ts)
 * ama bu formda henüz düzenlenebilir değil — her ikisi de sabit varsayılanla gönderiliyor
 * (create-milestone.usecase.ts notundaki AYNI kapsam sınırı: hatırlatma e-postası akışının
 * KENDİSİ henüz hiçbir günde planlanmadı).
 */
export function MilestonesTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [tarih, setTarih] = useState('');
  const [baslik, setBaslik] = useState('');
  const [aciklama, setAciklama] = useState('');

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => fetchMilestones(projectId),
  });

  const mutation = useMutation({
    mutationFn: () => createMilestone(projectId, tarih, baslik, aciklama || undefined),
    onSuccess: () => {
      setTarih('');
      setBaslik('');
      setAciklama('');
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-900">Yeni kilometre taşı</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tarih</label>
            <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Başlık</label>
            <input value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="örn. Prototip Teslimi" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-gray-600 mb-1">Açıklama (opsiyonel)</label>
            <input value={aciklama} onChange={(e) => setAciklama(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={!tarih || !baslik || mutation.isPending}
          className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
        >
          Ekle
        </button>
        {mutation.isError && (
          <p className="text-xs text-red-600">{mutation.error instanceof Error ? mutation.error.message : 'Kilometre taşı kaydedilemedi'}</p>
        )}
      </div>

      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}

      {!isLoading && milestones.length === 0 && (
        <EmptyState title="Henüz kilometre taşı yok" description="Bu projenin zaman çizelgesinde henüz önemli bir tarih işaretlenmedi." />
      )}

      {milestones.length > 0 && (
        <div className="relative border-l-2 border-gray-200 ml-2 space-y-6">
          {milestones.map((m) => (
            <div key={m.id} className="ml-4 relative">
              <span
                className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                  m.tarih < today ? 'bg-gray-400' : 'bg-gray-900'
                }`}
              />
              <p className="text-xs text-gray-400">{m.tarih}</p>
              <p className="text-sm font-medium text-gray-900">{m.baslik}</p>
              {m.aciklama && <p className="text-xs text-gray-600">{m.aciklama}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
