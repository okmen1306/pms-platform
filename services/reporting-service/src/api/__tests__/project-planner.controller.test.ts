import Fastify from 'fastify';
import { describe, it, expect } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerProjectPlannerRoutes } from '../project-planner.controller';
import type { ReportRepository, ProjectPlannerSnapshotRow } from '../../infrastructure/database/report.repository';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';

function buildApp(snapshot: ProjectPlannerSnapshotRow | null) {
  const app = Fastify();
  registerErrorHandler(app);
  const reportRepo = { findPlannerSnapshot: async () => snapshot } as unknown as ReportRepository;
  registerProjectPlannerRoutes(app, { reportRepo });
  return app;
}

describe('GET /reports/project-planner (B3, Day 12)', () => {
  it('snapshot yoksa 404 döner', async () => {
    const app = buildApp(null);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: `/reports/project-planner?projectId=${PROJECT_ID}` });
    expect(res.statusCode).toBe(404);
  });

  it('snapshot varsa 200 + camelCase\'e çevrilmiş snapshot\'ı döner (Day 13 düzeltmesi — diğer TÜM reporting uç noktalarıyla tutarlı)', async () => {
    const app = buildApp({
      project_id: PROJECT_ID,
      proje_adi: 'Test Projesi',
      planlanan_baslangic: '2026-01-01',
      planlanan_sure_hafta: 10,
      fiili_baslangic: null,
      fiili_sure_hafta: null,
      tamamlanma_yuzdesi: 25,
      guncelleme: new Date().toISOString(),
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: `/reports/project-planner?projectId=${PROJECT_ID}` });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.projeAdi).toBe('Test Projesi');
    expect(data.planlananBaslangic).toBe('2026-01-01');
    expect(data.planlananSureHafta).toBe(10);
    expect(data.tamamlanmaYuzdesi).toBe(25);
    expect(data.proje_adi).toBeUndefined();
  });

  it('projectId geçersizse 422 döner', async () => {
    const app = buildApp(null);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/reports/project-planner?projectId=gecersiz' });
    expect(res.statusCode).toBe(422);
  });
});
