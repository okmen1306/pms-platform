import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchEmployees, type EmployeeListItem } from './personnel.api';
import { DataTable, type DataTableColumn } from '../../shared/components/DataTable';
import { CurrencyBadge } from '../../shared/components/CurrencyBadge';
import { RoleGuard } from '../../shared/components/RoleGuard';
import { PERMISSION_KEYS } from '@pms/shared';

/**
 * docs/roadmap.md Bölüm 6 — personnel modülü. Day 3: gerçek personnel-service'e (geçici
 * doğrudan bağlantı, bkz. personnel.api.ts) bağlı ilk liste ekranı. Maaş kolonu, RoleGuard ile
 * `personnel.salary` izni olmayan kullanıcılara HİÇ GÖSTERİLMEZ — backend zaten fail-closed
 * null dönüyor (Day 2), frontend de kolonu tamamen gizleyerek görsel tutarlılığı koruyor.
 */
export function EmployeeListPage() {
  const { t } = useTranslation();
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => fetchEmployees(),
  });

  const columns: DataTableColumn<EmployeeListItem>[] = [
    { key: 'ad', header: 'Ad Soyad', render: (e) => `${e.ad} ${e.soyad}` },
    { key: 'email', header: t('auth.email'), render: (e) => e.email },
    {
      key: 'durum',
      header: 'Durum',
      render: (e) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            e.durum === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {e.durum === 'active' ? 'Aktif' : 'Pasif'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Personel</h1>
      </div>

      <RoleGuard permissionKey={PERMISSION_KEYS.PERSONNEL_SALARY}>
        {/* Maaş özet kartı sadece izinli kullanıcıya görünür — DataTable'a ayrı kolon
            eklemek yerine, madde 18 kuralına uygun şekilde tamamen ayrı bir blok olarak. */}
        <div className="text-xs text-gray-500">
          Maaş bilgisi bu görünümde özet kart olarak eklenecek (Day 22, gerçek izin API'si).
        </div>
      </RoleGuard>

      <DataTable
        columns={columns}
        rows={employees}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        emptyTitle="Henüz personel eklenmedi"
        emptyDescription="Yeni personel eklemek için İK yöneticinizle iletişime geçin."
      />
    </div>
  );
}
