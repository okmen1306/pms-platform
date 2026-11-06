import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_KEYS } from '@pms/shared';
import { fetchProjects, type ProjectDetail } from './project.api';
import { fetchEmployees } from '../personnel/personnel.api';
import { DataTable, type DataTableColumn } from '../../shared/components/DataTable';
import { RoleGuard } from '../../shared/components/RoleGuard';
import { PROJECT_STATUS_LABEL } from './projectLabels';

/**
 * Day 20 (G-07): backend'in `GET /projects`'i (durum + ekipLideriId filtreleri) Day 6'dan beri vardı
 * ama UI'dan hiç çağrılmıyordu — proje yalnızca ID'sini bilen biri `/projects/:id` URL'ine
 * girerek görülebiliyordu.
 */
export function ProjectListPage() {
  const [durum, setDurum] = useState('');
  const [ekipLideriId, setEkipLideriId] = useState('');

  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ['projects', { durum, ekipLideriId }],
    queryFn: () => fetchProjects({ durum: durum || undefined, ekipLideriId: ekipLideriId || undefined }),
  });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => fetchEmployees() });
  const employeeName = new Map(employees.map((e) => [e.id, `${e.ad} ${e.soyad}`]));

  const columns: DataTableColumn<ProjectDetail>[] = [
    {
      key: 'ad',
      header: 'Proje',
      render: (p) => (
        <Link to={`/projects/${p.id}`} className="text-blue-600 hover:underline">
          {p.proje_adi}
        </Link>
      ),
    },
    { key: 'durum', header: 'Durum', render: (p) => PROJECT_STATUS_LABEL[p.durum] ?? p.durum },
    { key: 'tarih', header: 'Başlangıç — Bitiş', render: (p) => `${p.baslangic_tarihi} — ${p.bitis_tarihi}` },
    { key: 'sure', header: 'Süre', render: (p) => `${p.sure_hafta} hafta` },
    { key: 'lider', header: 'Ekip Lideri', render: (p) => employeeName.get(p.ekip_lideri_id) ?? '—' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Projeler</h1>
        <RoleGuard permissionKey={PERMISSION_KEYS.PROJECT_RECORDS} need="edit">
          <Link to="/projects/new" className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5">
            Yeni Proje
          </Link>
        </RoleGuard>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={durum} onChange={(e) => setDurum(e.target.value)} aria-label="Duruma göre filtrele" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Tüm durumlar</option>
          {Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={ekipLideriId} onChange={(e) => setEkipLideriId(e.target.value)} aria-label="Ekip lideri filtresi" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Tüm ekip liderleri</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.ad} {e.soyad}</option>
          ))}
        </select>
      </div>

      {isError ? (
        <p className="text-xs text-red-600">Projeler alınamadı.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={projects}
          rowKey={(p) => p.id}
          isLoading={isLoading}
          emptyTitle="Proje bulunamadı"
          emptyDescription="Filtreleri değiştirin veya yeni bir proje oluşturun."
        />
      )}
    </div>
  );
}
