import { PERMISSION_KEYS, type EffectivePermission } from '@pms/shared';
import type { EmployeeRepository, EmployeeRow } from '../../infrastructure/database/employee.repository';

export interface PublicEmployee extends Omit<EmployeeRow, 'maas_tl'> {
  maasTl: number | null; // izin yoksa null (uygulama katmanı maskeleme, bkz. Bölüm 11.1)
}

/**
 * Kural: yönetici ve İK dışında maaş bilgisini kimse görmemeli. RLS (012_rls_policies.sql)
 * SATIR erişimini kontrol eder, bu fonksiyon ise KOLON maskelemesini yapar (Postgres'te
 * kolon-seviyesi RLS olmadığından — bkz. docs/roadmap.md Bölüm 11.1 notu).
 */
export function toPublicEmployee(row: EmployeeRow, callerPermissions: EffectivePermission[]): PublicEmployee {
  const canSeeSalary = callerPermissions.some(
    (p) => p.permissionKey === PERMISSION_KEYS.PERSONNEL_SALARY && p.canView,
  );
  const { maas_tl, ...rest } = row;
  return { ...rest, maasTl: canSeeSalary ? maas_tl : null };
}

export async function listEmployees(
  filters: { durum?: string },
  callerPermissions: EffectivePermission[],
  repo: EmployeeRepository,
): Promise<PublicEmployee[]> {
  const rows = await repo.findAll(filters);
  return rows.map((row) => toPublicEmployee(row, callerPermissions));
}
