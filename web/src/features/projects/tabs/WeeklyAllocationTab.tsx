import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWeeklyAllocations, createWeeklyAllocation, fetchProject } from '../project.api';
import { fetchTeams } from '../../personnel/personnel.api';
import { describeProjectError } from '../projectErrors';

/**
 * F1 (Day 7): Day 6'da eklenen backend özelliğinin (allocate-team-weekly.usecase.ts) UI'ı.
 * Kural #7 (docs/roadmap.md): "Bir ekibe verilen haftalık sürelerin toplamı, projenin bitiş
 * hafta sayısını aşamaz." Bu kural backend'de zaten uygulanıyor (409/422 döner); burada
 * SADECE her ekibin şu ana kadarki toplamını `sureHafta` ile karşılaştırıp görsel bir uyarı
 * gösteriyoruz — asıl garanti backend'de.
 */
export function WeeklyAllocationTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState('');
  const [haftaNo, setHaftaNo] = useState('');
  const [planlananSure, setPlanlananSure] = useState('');

  const { data: project } = useQuery({ queryKey: ['project', projectId], queryFn: () => fetchProject(projectId) });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams });
  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ['weekly-allocation', projectId],
    queryFn: () => fetchWeeklyAllocations(projectId),
  });

  const mutation = useMutation({
    mutationFn: () => createWeeklyAllocation(projectId, teamId, Number(haftaNo), Number(planlananSure)),
    onSuccess: () => {
      setHaftaNo('');
      setPlanlananSure('');
      queryClient.invalidateQueries({ queryKey: ['weekly-allocation', projectId] });
    },
  });

  const totalsByTeam = allocations.reduce<Record<string, number>>((acc, a) => {
    acc[a.team_id] = (acc[a.team_id] ?? 0) + Number(a.planlanan_sure_hafta);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-900">Yeni haftalık planlama ekle</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Ekip</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">Seçiniz</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.ad}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Hafta No {project ? `(1-${project.sure_hafta})` : ''}</label>
            <input type="number" min={1} max={project?.sure_hafta} value={haftaNo} onChange={(e) => setHaftaNo(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Planlanan Süre (hafta)</label>
            <input type="number" min={0.5} step={0.5} value={planlananSure} onChange={(e) => setPlanlananSure(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={!teamId || !haftaNo || !planlananSure || mutation.isPending}
          className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
        >
          Kaydet
        </button>
        {mutation.isError && (
          <p className="text-xs text-red-600">
            {describeProjectError(
              mutation.error,
              { teamName: teams.find((t) => t.id === teamId)?.ad, projectWeeks: project?.sure_hafta },
              'Kaydedilemedi',
            )}
          </p>
        )}
      </div>

      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {teams.map((team) => {
          const total = totalsByTeam[team.id] ?? 0;
          const cap = project?.sure_hafta ?? 0;
          const teamRows = allocations.filter((a) => a.team_id === team.id).sort((a, b) => a.hafta_no - b.hafta_no);
          if (teamRows.length === 0) return null;
          return (
            <div key={team.id} className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{team.ad}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${total >= cap ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                  {total} / {cap} hafta
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {teamRows.map((a) => (
                  <span key={a.id} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-0.5">
                    Hafta {a.hafta_no}: {a.planlanan_sure_hafta}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
