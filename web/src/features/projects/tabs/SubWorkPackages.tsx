import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSubWorkPackages,
  addSubWorkPackage,
  updateSubWorkPackage,
  deleteSubWorkPackage,
  type SubWorkPackage,
} from '../project.api';
import { describeProjectError } from '../projectErrors';

const inputClass = 'rounded-md border border-gray-300 px-2 py-1 text-sm';

/**
 * Day 20: alt iş paketi ekle/düzenle/sil (backend CRUD Day 5'ten beri vardı; PATCH/DELETE'in
 * tarayıcıdan çalışması için gereken CORS düzeltmesi Day 19'da yapıldı, UI bugün). Kural: alt
 * iş paketleri proje başladıktan sonra da değiştirilebilir; üst paketin hafta aralığı dışına
 * taşan giriş backend'de reddedilir (WorkPackageDateOutOfRangeError) ve mesaj burada gösterilir.
 */
export function SubWorkPackages({ workPackageId }: { workPackageId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['sub-work-packages', workPackageId];
  const [ad, setAd] = useState('');
  const [baslangicHafta, setBaslangicHafta] = useState('1');
  const [bitisHafta, setBitisHafta] = useState('1');
  const [editing, setEditing] = useState<SubWorkPackage | null>(null);

  const { data: items = [], isLoading } = useQuery({ queryKey, queryFn: () => fetchSubWorkPackages(workPackageId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const addMutation = useMutation({
    mutationFn: () => addSubWorkPackage(workPackageId, { ad: ad.trim(), baslangicHafta: Number(baslangicHafta), bitisHafta: Number(bitisHafta) }),
    onSuccess: () => { setAd(''); refresh(); },
  });
  const updateMutation = useMutation({
    mutationFn: (item: SubWorkPackage) => updateSubWorkPackage(item.id, { ad: item.ad, baslangicHafta: item.baslangic_hafta, bitisHafta: item.bitis_hafta }),
    onSuccess: () => { setEditing(null); refresh(); },
  });
  const deleteMutation = useMutation({ mutationFn: (id: string) => deleteSubWorkPackage(id), onSuccess: refresh });

  const rangeInvalid = Number(bitisHafta) < Number(baslangicHafta);
  const error = addMutation.error ?? updateMutation.error ?? deleteMutation.error;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3" aria-label="Alt iş paketleri">
      <p className="text-sm font-medium text-gray-900">Alt iş paketleri</p>
      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
      {!isLoading && items.length === 0 && <p className="text-xs text-gray-500">Bu iş paketi için henüz alt kırılım yok.</p>}

      <ul className="divide-y divide-gray-100 bg-white rounded-md border border-gray-200">
        {items.map((item) =>
          editing?.id === item.id ? (
            <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <input aria-label="Ad" value={editing.ad} onChange={(e) => setEditing({ ...editing, ad: e.target.value })} className={`${inputClass} flex-1 min-w-32`} />
              <input aria-label="Başlangıç haftası" type="number" min="1" value={editing.baslangic_hafta} onChange={(e) => setEditing({ ...editing, baslangic_hafta: Number(e.target.value) })} className={`${inputClass} w-16`} />
              <input aria-label="Bitiş haftası" type="number" min="1" value={editing.bitis_hafta} onChange={(e) => setEditing({ ...editing, bitis_hafta: Number(e.target.value) })} className={`${inputClass} w-16`} />
              <button onClick={() => updateMutation.mutate(editing)} disabled={updateMutation.isPending || editing.ad.trim() === '' || editing.bitis_hafta < editing.baslangic_hafta} className="text-xs text-blue-600 disabled:opacity-50">Kaydet</button>
              <button onClick={() => setEditing(null)} className="text-xs text-gray-500">Vazgeç</button>
            </li>
          ) : (
            <li key={item.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-gray-800">
                {item.ad} <span className="text-xs text-gray-400">· {item.baslangic_hafta}–{item.bitis_hafta}. hafta</span>
              </span>
              <span className="flex gap-3">
                <button onClick={() => setEditing(item)} className="text-xs text-blue-600 hover:underline">Düzenle</button>
                <button
                  onClick={() => { if (window.confirm(`"${item.ad}" alt iş paketi silinsin mi?`)) deleteMutation.mutate(item.id); }}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Sil
                </button>
              </span>
            </li>
          ),
        )}
      </ul>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-32">
          <label htmlFor={`sub-ad-${workPackageId}`} className="block text-xs text-gray-600 mb-1">Ad</label>
          <input id={`sub-ad-${workPackageId}`} value={ad} onChange={(e) => setAd(e.target.value)} className={`${inputClass} w-full`} />
        </div>
        <div>
          <label htmlFor={`sub-bas-${workPackageId}`} className="block text-xs text-gray-600 mb-1">Başlangıç haftası</label>
          <input id={`sub-bas-${workPackageId}`} type="number" min="1" value={baslangicHafta} onChange={(e) => setBaslangicHafta(e.target.value)} className={`${inputClass} w-20`} />
        </div>
        <div>
          <label htmlFor={`sub-bit-${workPackageId}`} className="block text-xs text-gray-600 mb-1">Bitiş haftası</label>
          <input id={`sub-bit-${workPackageId}`} type="number" min="1" value={bitisHafta} onChange={(e) => setBitisHafta(e.target.value)} className={`${inputClass} w-20`} />
        </div>
        <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || ad.trim() === '' || rangeInvalid} className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50">
          Ekle
        </button>
      </div>
      {rangeInvalid && <p role="alert" className="text-xs text-red-600">Bitiş haftası, başlangıç haftasından önce olamaz.</p>}
      {error && <p role="alert" className="text-xs text-red-600">{describeProjectError(error, {}, 'İşlem başarısız')}</p>}
    </div>
  );
}
