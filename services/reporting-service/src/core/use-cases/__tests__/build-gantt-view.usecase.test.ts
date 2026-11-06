import { describe, it, expect } from 'vitest';
import { buildGanttView } from '../build-gantt-view.usecase';
import type { ReportRepository, ProjectProgressRow } from '../../../infrastructure/database/report.repository';
import type { ProjectServiceClient } from '../../../infrastructure/external/project-service.client';
import type { PersonnelServiceClient } from '../../../infrastructure/external/personnel-service.client';

const PROJECT_ID = 'proje-1';

function fakeRepo(rows: ProjectProgressRow[]): ReportRepository {
  return {
    listProgressByProject: async () => rows,
  } as unknown as ReportRepository;
}

function fakeProjectClient(names: Record<string, string> = {}): ProjectServiceClient {
  return { resolveWorkPackageNames: async () => new Map(Object.entries(names)) } as unknown as ProjectServiceClient;
}

function fakePersonnelClient(names: Record<string, string> = {}): PersonnelServiceClient {
  return { resolveEmployeeNames: async () => new Map(Object.entries(names)) } as unknown as PersonnelServiceClient;
}

function row(partial: Partial<ProjectProgressRow>): ProjectProgressRow {
  return {
    id: 'p-1',
    project_id: PROJECT_ID,
    work_package_id: 'wp-1',
    employee_id: 'emp-1',
    tamamlanma_yuzdesi: 0,
    baslangic_tarihi: null,
    bitis_tarihi: null,
    guncelleme_zamani: new Date().toISOString(),
    ...partial,
  };
}

describe('buildGanttView (B3, Day 12 + B1/B2, Day 13 — iş paketi VE personel isim çözümü)', () => {
  it('tamamlanma_yuzdesi >= 100 olan satırlar "tamamlandi" durumundadır', async () => {
    const [entry] = await buildGanttView(PROJECT_ID, fakeRepo([row({ tamamlanma_yuzdesi: 100 })]), fakeProjectClient(), fakePersonnelClient());
    expect(entry.durum).toBe('tamamlandi');
  });

  it('tamamlanma_yuzdesi < 100 olan satırlar "devam_ediyor" durumundadır', async () => {
    const [entry] = await buildGanttView(PROJECT_ID, fakeRepo([row({ tamamlanma_yuzdesi: 40 })]), fakeProjectClient(), fakePersonnelClient());
    expect(entry.durum).toBe('devam_ediyor');
  });

  it('satırları başlangıç tarihine göre KRONOLOJİK sıralar', async () => {
    const rows = [
      row({ work_package_id: 'wp-b', baslangic_tarihi: '2026-03-01' }),
      row({ work_package_id: 'wp-a', baslangic_tarihi: '2026-01-01' }),
    ];
    const result = await buildGanttView(PROJECT_ID, fakeRepo(rows), fakeProjectClient(), fakePersonnelClient());
    expect(result.map((r) => r.workPackageId)).toEqual(['wp-a', 'wp-b']);
  });

  it('B1 (Day 13): work_package_id ÇÖZÜMLENEBİLİYORSA workPackageName doldurulur', async () => {
    const [entry] = await buildGanttView(
      PROJECT_ID,
      fakeRepo([row({ work_package_id: 'wp-1' })]),
      fakeProjectClient({ 'wp-1': 'Saha Kurulumu' }),
      fakePersonnelClient(),
    );
    expect(entry.workPackageName).toBe('Saha Kurulumu');
  });

  it('B2 (Day 13): employee_id ÇÖZÜMLENEBİLİYORSA employeeName doldurulur', async () => {
    const [entry] = await buildGanttView(
      PROJECT_ID,
      fakeRepo([row({ employee_id: 'emp-1' })]),
      fakeProjectClient(),
      fakePersonnelClient({ 'emp-1': 'Ayşe Yılmaz' }),
    );
    expect(entry.employeeName).toBe('Ayşe Yılmaz');
  });

  it('work_package_id/employee_id NULL ise isim çözümlemeye HİÇ gitmez, null kalır', async () => {
    const [entry] = await buildGanttView(
      PROJECT_ID,
      fakeRepo([row({ work_package_id: null, employee_id: null })]),
      fakeProjectClient({ 'wp-1': 'Kullanılmayacak' }),
      fakePersonnelClient({ 'emp-1': 'Kullanılmayacak' }),
    );
    expect(entry.workPackageName).toBeNull();
    expect(entry.employeeName).toBeNull();
  });

  it('hiç satır yoksa boş dizi döner', async () => {
    const result = await buildGanttView(PROJECT_ID, fakeRepo([]), fakeProjectClient(), fakePersonnelClient());
    expect(result).toEqual([]);
  });
});
