import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_KEYS } from '@pms/shared';
import { fetchProject, updateProject, type ProjectDetail } from '../project.api';
import { fetchEmployees } from '../../personnel/personnel.api';
import { describeProjectError } from '../projectErrors';
import { PROJECT_STATUS_LABEL } from '../projectLabels';
import { RoleGuard } from '../../../shared/components/RoleGuard';

const inputClass = 'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm';

/**
 * Day 6: docs/roadmap.md'de tarif edilen "her projenin ana sayfasında önemli tarihlerin ve
 * açıklamalarının olduğu bir alan" burada temel proje bilgisiyle karşılanıyor. Day 20:
 * `PATCH /projects/:id` ile düzenleme (ad, tarihler, ekip lideri). Tarih değişince süre
 * sunucuda yeniden hesaplanır; yeni süre bir ekibin haftalık planlamasının altına düşerse 409
 * döner ve mesaj gösterilir (Kural #7).
 */
export function OverviewTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProjectDetail | null>(null);
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId),
  });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => fetchEmployees() });

  const mutation = useMutation({
    mutationFn: (d: ProjectDetail) =>
      updateProject(projectId, {
        projeAdi: d.proje_adi.trim(),
        baslangicTarihi: d.baslangic_tarihi,
        bitisTarihi: d.bitis_tarihi,
        ekipLideriId: d.ekip_lideri_id,
      }),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  if (isLoading) return <p className="text-xs text-gray-500">Yükleniyor...</p>;
  if (isError || !project) return <p className="text-xs text-red-600">Proje bilgisi alınamadı.</p>;

  const leaderName = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.ad} ${e.soyad}` : '—';
  };

  if (draft) {
    const datesInvalid = draft.bitis_tarihi < draft.baslangic_tarihi;
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 max-w-xl">
        <div>
          <label htmlFor="edit-ad" className="block text-xs text-gray-600 mb-1">Proje adı</label>
          <input id="edit-ad" value={draft.proje_adi} onChange={(e) => setDraft({ ...draft, proje_adi: e.target.value })} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-bas" className="block text-xs text-gray-600 mb-1">Başlangıç</label>
            <input id="edit-bas" type="date" value={draft.baslangic_tarihi} onChange={(e) => setDraft({ ...draft, baslangic_tarihi: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="edit-bit" className="block text-xs text-gray-600 mb-1">Bitiş</label>
            <input id="edit-bit" type="date" value={draft.bitis_tarihi} onChange={(e) => setDraft({ ...draft, bitis_tarihi: e.target.value })} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="edit-lider" className="block text-xs text-gray-600 mb-1">Ekip lideri</label>
          <select id="edit-lider" value={draft.ekip_lideri_id} onChange={(e) => setDraft({ ...draft, ekip_lideri_id: e.target.value })} className={inputClass}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.ad} {e.soyad}</option>)}
          </select>
        </div>
        {/* Bilinen sınır (Day 22 / G-14): finans/rapor/bildirim özetleri `project.created` anında alınıyor. */}
        <p className="text-xs text-gray-500">Not: Değişiklikler maliyet ve rapor özetlerine henüz yansımaz.</p>
        {datesInvalid && <p role="alert" className="text-xs text-red-600">Bitiş tarihi, başlangıç tarihinden önce olamaz.</p>}
        {mutation.isError && (
          <p role="alert" className="text-xs text-red-600">{describeProjectError(mutation.error, { projectWeeks: project.sure_hafta }, 'Proje güncellenemedi')}</p>
        )}
        <div className="flex gap-2">
          <button onClick={() => mutation.mutate(draft)} disabled={mutation.isPending || datesInvalid || draft.proje_adi.trim().length < 2} className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50">Kaydet</button>
          <button onClick={() => { setDraft(null); mutation.reset(); }} className="text-xs text-gray-500">Vazgeç</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Proje Adı</p>
          <p className="text-sm font-medium text-gray-900">{project.proje_adi}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Durum</p>
          <p className="text-sm font-medium text-gray-900">{PROJECT_STATUS_LABEL[project.durum] ?? project.durum}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Başlangıç / Bitiş</p>
          <p className="text-sm font-medium text-gray-900">{project.baslangic_tarihi} — {project.bitis_tarihi}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Süre (otomatik hesaplanan)</p>
          <p className="text-sm font-medium text-gray-900">{project.sure_hafta} hafta</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Ekip Lideri</p>
          <p className="text-sm font-medium text-gray-900">{leaderName(project.ekip_lideri_id)}</p>
        </div>
      </div>
      <RoleGuard permissionKey={PERMISSION_KEYS.PROJECT_RECORDS} need="edit">
        <button onClick={() => setDraft(project)} className="text-xs text-blue-600 hover:underline">Projeyi düzenle</button>
      </RoleGuard>
    </div>
  );
}
