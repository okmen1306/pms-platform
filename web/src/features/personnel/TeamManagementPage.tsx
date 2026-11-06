import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTeams, fetchTeamMembers, createTeam, addTeamMember, fetchEmployees, type Team } from './personnel.api';
import { DataTable, type DataTableColumn } from '../../shared/components/DataTable';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * docs/roadmap.md Bölüm 6 — personnel modülü. Day 4: sol tarafta ekip listesi, sağda seçili
 * ekibin üyeleri. Kural (madde 8): bir personel birden fazla ekipte çalışabilir — bu yüzden
 * "üye ekle" formu employee-service listesinden herhangi bir personeli seçmeye izin verir
 * (başka bir ekipte olması engel değildir).
 */
export function TeamManagementPage() {
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const { data: teams = [], isLoading: teamsLoading } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => fetchEmployees() });
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', selectedTeamId],
    queryFn: () => fetchTeamMembers(selectedTeamId!),
    enabled: !!selectedTeamId,
  });

  const createTeamMutation = useMutation({
    mutationFn: () => createTeam(newTeamName),
    onSuccess: () => {
      setNewTeamName('');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: () => addTeamMember(selectedTeamId!, selectedEmployeeId),
    onSuccess: () => {
      setSelectedEmployeeId('');
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeamId] });
    },
  });

  const memberColumns: DataTableColumn<{ id: string; employee_id: string; sorumluluk: string | null }>[] = [
    {
      key: 'employee',
      header: 'Personel',
      render: (m) => {
        const emp = employees.find((e) => e.id === m.employee_id);
        return emp ? `${emp.ad} ${emp.soyad}` : m.employee_id;
      },
    },
    { key: 'sorumluluk', header: 'Sorumluluk', render: (m) => m.sorumluluk ?? '—' },
  ];

  return (
    <div className="p-6 grid grid-cols-3 gap-6">
      <div className="col-span-1 space-y-3">
        <h1 className="text-lg font-semibold text-gray-900">Ekipler</h1>
        <div className="flex gap-2">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Yeni ekip adı"
            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            onClick={() => createTeamMutation.mutate()}
            disabled={!newTeamName || createTeamMutation.isPending}
            className="rounded-md bg-gray-900 text-white text-xs px-3 py-1 disabled:opacity-50"
          >
            Ekle
          </button>
        </div>

        {teamsLoading ? (
          <p className="text-xs text-gray-400">Yükleniyor...</p>
        ) : teams.length === 0 ? (
          <EmptyState title="Henüz ekip yok" description="Yukarıdan yeni bir ekip oluşturabilirsiniz." />
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {teams.map((team: Team) => (
              <li key={team.id}>
                <button
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    selectedTeamId === team.id ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
                  }`}
                >
                  {team.ad}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="col-span-2 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {selectedTeamId ? teams.find((t) => t.id === selectedTeamId)?.ad ?? 'Üyeler' : 'Bir ekip seçin'}
        </h2>

        {selectedTeamId && (
          <>
            <div className="flex gap-2">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">Personel seçin...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.ad} {e.soyad}
                  </option>
                ))}
              </select>
              <button
                onClick={() => addMemberMutation.mutate()}
                disabled={!selectedEmployeeId || addMemberMutation.isPending}
                className="rounded-md bg-gray-900 text-white text-xs px-3 py-1 disabled:opacity-50"
              >
                Ekibe Ekle
              </button>
            </div>

            <DataTable
              columns={memberColumns}
              rows={members}
              rowKey={(m) => m.id}
              isLoading={membersLoading}
              emptyTitle="Bu ekipte henüz üye yok"
            />
          </>
        )}
      </div>
    </div>
  );
}
