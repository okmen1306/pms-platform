import Fastify, { type FastifyInstance } from 'fastify';
import { describe, it, expect } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerWorkflowReportRoutes } from '../workflow-report.controller';
import type { ReportRepository, ProjectProgressRow } from '../../infrastructure/database/report.repository';
import type { ProjectServiceClient } from '../../infrastructure/external/project-service.client';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';

function buildApp(rows: ProjectProgressRow[]) {
  const app = Fastify();
  registerErrorHandler(app);
  const reportRepo = { listProgressByProject: async () => rows } as unknown as ReportRepository;
  const projectServiceClient = { resolveWorkPackageNames: async () => new Map([['wp-1', 'Saha Kurulumu']]) } as unknown as ProjectServiceClient;
  const personnelServiceClient = { resolveEmployeeNames: async () => new Map([['emp-1', 'Ayşe Yılmaz']]) } as unknown as PersonnelServiceClient;
  registerWorkflowReportRoutes(app, { reportRepo, projectServiceClient, personnelServiceClient });
  return app;
}

describe('GET /reports/workflow-status (B3, Day 12 + B1/B2, Day 13)', () => {
  let app: FastifyInstance;

  it('projectId eksikse 422 döner', async () => {
    app = buildApp([]);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/reports/workflow-status' });
    expect(res.statusCode).toBe(422);
  });

  it('geçerli projectId ile 200 + iş paketi/personel adı çözümlenmiş liste döner', async () => {
    app = buildApp([
      {
        id: 'p-1',
        project_id: PROJECT_ID,
        work_package_id: 'wp-1',
        employee_id: 'emp-1',
        tamamlanma_yuzdesi: 100,
        baslangic_tarihi: '2026-01-01',
        bitis_tarihi: '2026-01-10',
        guncelleme_zamani: new Date().toISOString(),
      },
    ]);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: `/reports/workflow-status?projectId=${PROJECT_ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[0].durum).toBe('tamamlandi');
    expect(res.json().data[0].workPackageName).toBe('Saha Kurulumu');
    expect(res.json().data[0].employeeName).toBe('Ayşe Yılmaz');
  });
});
