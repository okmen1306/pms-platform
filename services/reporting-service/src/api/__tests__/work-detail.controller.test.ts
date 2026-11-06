import Fastify from 'fastify';
import { describe, it, expect } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerWorkDetailRoutes } from '../work-detail.controller';
import type { ReportRepository, WorkloadSnapshotRow } from '../../infrastructure/database/report.repository';
import type { ProjectServiceClient } from '../../infrastructure/external/project-service.client';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';

function buildApp(rows: WorkloadSnapshotRow[]) {
  const app = Fastify();
  registerErrorHandler(app);
  const reportRepo = { listWorkloadByProject: async () => rows } as unknown as ReportRepository;
  const projectServiceClient = { resolveWorkPackageNames: async () => new Map([['wp-1', 'Mekanik Montaj']]) } as unknown as ProjectServiceClient;
  const personnelServiceClient = { resolveEmployeeNames: async () => new Map([['emp-1', 'Ayşe Yılmaz']]) } as unknown as PersonnelServiceClient;
  registerWorkDetailRoutes(app, { reportRepo, projectServiceClient, personnelServiceClient });
  return app;
}

describe('GET /reports/work-detail (B3, Day 12 + B1/B2, Day 13)', () => {
  it('projectId eksikse 422 döner', async () => {
    const app = buildApp([]);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/reports/work-detail' });
    expect(res.statusCode).toBe(422);
  });

  it('iş paketi VE personel adı çözümlenmiş şekilde matrisi döner', async () => {
    const app = buildApp([
      { id: 'w-1', employee_id: 'emp-1', hafta_no: 1, project_id: PROJECT_ID, work_package_id: 'wp-1', guncelleme: new Date().toISOString() },
    ]);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: `/reports/work-detail?projectId=${PROJECT_ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[0].workPackageName).toBe('Mekanik Montaj');
    expect(res.json().data[0].haftalar[0].employeeName).toBe('Ayşe Yılmaz');
  });
});
