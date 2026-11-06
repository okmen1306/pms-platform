import { describe, it, expect } from 'vitest';
import { buildWorkloadMatrix } from '../build-workload-matrix.usecase';
import type { ReportRepository, WorkloadSnapshotRow } from '../../../infrastructure/database/report.repository';
import type { ProjectServiceClient } from '../../../infrastructure/external/project-service.client';
import type { PersonnelServiceClient } from '../../../infrastructure/external/personnel-service.client';

const PROJECT_ID = 'proje-1';

function fakeRepo(rows: WorkloadSnapshotRow[]): ReportRepository {
  return { listWorkloadByProject: async () => rows } as unknown as ReportRepository;
}

function fakeProjectClient(names: Record<string, string>): ProjectServiceClient {
  return { resolveWorkPackageNames: async () => new Map(Object.entries(names)) } as unknown as ProjectServiceClient;
}

function fakePersonnelClient(names: Record<string, string>): PersonnelServiceClient {
  return { resolveEmployeeNames: async () => new Map(Object.entries(names)) } as unknown as PersonnelServiceClient;
}

function row(partial: Partial<WorkloadSnapshotRow>): WorkloadSnapshotRow {
  return { id: 'w-1', employee_id: 'emp-1', hafta_no: 1, project_id: PROJECT_ID, work_package_id: 'wp-1', guncelleme: new Date().toISOString(), ...partial };
}

describe('buildWorkloadMatrix (B3, Day 12 + B1/B2, Day 13 — iş paketi VE personel isim çözümü)', () => {
  it('aynı iş paketine ait haftaları GRUPLAR', async () => {
    const rows = [row({ hafta_no: 1, employee_id: 'emp-1' }), row({ hafta_no: 2, employee_id: 'emp-1' })];
    const result = await buildWorkloadMatrix(PROJECT_ID, fakeRepo(rows), fakeProjectClient({}), fakePersonnelClient({}));
    expect(result).toHaveLength(1);
    expect(result[0].haftalar).toHaveLength(2);
  });

  it('project-service isim çözümlemesi VARSA workPackageName doldurulur', async () => {
    const [entry] = await buildWorkloadMatrix(
      PROJECT_ID,
      fakeRepo([row({ work_package_id: 'wp-1' })]),
      fakeProjectClient({ 'wp-1': 'Mekanik Montaj' }),
      fakePersonnelClient({}),
    );
    expect(entry.workPackageName).toBe('Mekanik Montaj');
  });

  it('project-service isim çözemezse (erişilemez/bulunamaz) workPackageName null olur, rapor BAŞARISIZ OLMAZ', async () => {
    const [entry] = await buildWorkloadMatrix(
      PROJECT_ID,
      fakeRepo([row({ work_package_id: 'wp-bilinmeyen' })]),
      fakeProjectClient({}),
      fakePersonnelClient({}),
    );
    expect(entry.workPackageName).toBeNull();
  });

  it('B2 (Day 13): personnel-service isim çözümlemesi VARSA her hafta satırında employeeName doldurulur', async () => {
    const rows = [row({ employee_id: 'emp-1', hafta_no: 1 }), row({ employee_id: 'emp-2', hafta_no: 1 })];
    const [entry] = await buildWorkloadMatrix(
      PROJECT_ID,
      fakeRepo(rows),
      fakeProjectClient({}),
      fakePersonnelClient({ 'emp-1': 'Ayşe Yılmaz', 'emp-2': 'Mehmet Demir' }),
    );
    expect(entry.haftalar.find((h) => h.employeeId === 'emp-1')?.employeeName).toBe('Ayşe Yılmaz');
    expect(entry.haftalar.find((h) => h.employeeId === 'emp-2')?.employeeName).toBe('Mehmet Demir');
  });

  it('B2 (Day 13): personnel-service isim çözemezse employeeName null olur, rapor BAŞARISIZ OLMAZ', async () => {
    const [entry] = await buildWorkloadMatrix(
      PROJECT_ID,
      fakeRepo([row({ employee_id: 'emp-bilinmeyen' })]),
      fakeProjectClient({}),
      fakePersonnelClient({}),
    );
    expect(entry.haftalar[0].employeeName).toBeNull();
  });

  it('FARKLI iş paketleri ayrı girdi olarak kalır', async () => {
    const result = await buildWorkloadMatrix(
      PROJECT_ID,
      fakeRepo([row({ work_package_id: 'wp-1' }), row({ work_package_id: 'wp-2' })]),
      fakeProjectClient({}),
      fakePersonnelClient({}),
    );
    expect(result).toHaveLength(2);
  });

  it('hiç satır yoksa boş dizi döner', async () => {
    const result = await buildWorkloadMatrix(PROJECT_ID, fakeRepo([]), fakeProjectClient({}), fakePersonnelClient({}));
    expect(result).toEqual([]);
  });
});
