import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProject, fetchProjectWorkPackages, fetchMasterWorkPackages, fetchWorkDraft, setWorkDraftCell } from '../project.api';
import { EmptyState } from '../../../shared/components/EmptyState';

/**
 * F1 (Day 10): "WorkDraftTab (haftalık boyalı görünüm)" — docs/roadmap.md Bölüm 14.3 satır 10.
 *
 * ÖNEMLİ (bkz. backend'deki Uzman İnisiyatifi notu, 003_project_tables.sql "Day 10" bölümü):
 * roadmap bu ekranın tam olarak neye benzemesi gerektiğini TANIMLAMIYOR — sadece "haftalık
 * boyalı görünüm" ifadesi var. Excel prototipinin "sadece sarı hücrelere müdahale" felsefesine
 * (Bölüm 1) sadık kalarak EN BASİT yorum uygulandı: satırlar iş paketleri, sütunlar proje
 * haftaları, her hücreye TIKLANARAK boyanır/boyası kaldırılır. Karmaşık bir durum/renk paleti
 * İCAT EDİLMEDİ. Gerçek isterler farklıysa bu ekran kolayca değiştirilebilir.
 */
export function WorkDraftTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();

  const { data: project } = useQuery({ queryKey: ['project', projectId], queryFn: () => fetchProject(projectId) });
  const { data: workPackages = [] } = useQuery({ queryKey: ['work-packages', projectId], queryFn: () => fetchProjectWorkPackages(projectId) });
  const { data: masterWorkPackages = [] } = useQuery({ queryKey: ['master-work-packages'], queryFn: fetchMasterWorkPackages });
  const { data: cells = [], isLoading } = useQuery({ queryKey: ['work-draft', projectId], queryFn: () => fetchWorkDraft(projectId) });

  const masterNameById = useMemo(() => new Map(masterWorkPackages.map((m) => [m.id, m.ad])), [masterWorkPackages]);
  const cellByKey = useMemo(() => new Map(cells.filter((c) => c.boyali).map((c) => [`${c.work_package_id}:${c.hafta_no}`, c])), [cells]);

  const mutation = useMutation({
    mutationFn: ({ workPackageId, haftaNo, boyali }: { workPackageId: string; haftaNo: number; boyali: boolean }) =>
      setWorkDraftCell(projectId, workPackageId, haftaNo, boyali),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-draft', projectId] }),
  });

  if (isLoading) return <p className="text-xs text-gray-500">Yükleniyor...</p>;

  if (workPackages.length === 0) {
    return <EmptyState title="Henüz iş paketi yok" description="Taslak oluşturabilmek için önce en az bir iş paketi planlanmalı." />;
  }

  const weeks = Array.from({ length: project?.sure_hafta ?? 0 }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-gray-500 font-medium">İş Paketi</th>
            {weeks.map((w) => (
              <th key={w} className="px-1 py-1 text-gray-400 font-normal w-7 text-center">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workPackages.map((wp) => (
            <tr key={wp.id}>
              <td className="px-2 py-1 text-gray-800 whitespace-nowrap">{masterNameById.get(wp.master_work_package_id) ?? wp.id}</td>
              {weeks.map((w) => {
                const painted = cellByKey.has(`${wp.id}:${w}`);
                return (
                  <td key={w} className="p-0.5">
                    <button
                      aria-label={`${w}. hafta`}
                      onClick={() => mutation.mutate({ workPackageId: wp.id, haftaNo: w, boyali: !painted })}
                      className={`w-6 h-6 rounded-sm border ${
                        painted ? 'bg-amber-300 border-amber-400' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-2">Bir hücreye tıklayarak o haftayı boyayın/boyasını kaldırın.</p>
    </div>
  );
}
