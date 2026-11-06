import Fastify from 'fastify';
import { describe, it, expect } from 'vitest';
import { registerErrorHandler, ServiceUnavailableError } from '@pms/shared';
import { registerTeamPerformanceReportRoutes } from '../team-performance-report.controller';
import { registerWorkflowReportRoutes } from '../workflow-report.controller';
import type { PerformanceServiceClient } from '../../infrastructure/external/performance-service.client';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';

describe('GET /reports/team-performance (B3, Day 21 — performance-service\'e ince proxy)', () => {
  it('ekip endekslerini liste olarak döner', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    const rows = [{ teamId: 't1', projectId: PROJECT_ID, endeksPuani: 82.5, guncelleme: '2026-10-14T10:00:00Z' }];
    registerTeamPerformanceReportRoutes(app, { performanceServiceClient: { getTeamIndices: async () => rows } as unknown as PerformanceServiceClient });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: `/reports/team-performance?projectId=${PROJECT_ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual(rows);
    expect(res.json().meta.total).toBe(1);
  });

  it('projectId geçersizse 422; performance-service düşerse 503', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    registerTeamPerformanceReportRoutes(app, {
      performanceServiceClient: { getTeamIndices: async () => { throw new ServiceUnavailableError('performance-service'); } } as unknown as PerformanceServiceClient,
    });
    await app.ready();
    expect((await app.inject({ method: 'GET', url: '/reports/team-performance?projectId=x' })).statusCode).toBe(422);
    expect((await app.inject({ method: 'GET', url: `/reports/team-performance?projectId=${PROJECT_ID}` })).statusCode).toBe(503);
  });
});

describe('GET /reports/workflow (spec adı) + /reports/workflow-status (geçici alias)', () => {
  it('iki yol da kayıtlı ve aynı yanıtı verir', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    registerWorkflowReportRoutes(app, {
      reportRepo: { listProgressByProject: async () => [], listWorkloadByProject: async () => [] } as any,
      projectServiceClient: { resolveWorkPackageNames: async () => new Map(), listWorkPackages: async () => [] } as any,
      personnelServiceClient: { resolveEmployeeNames: async () => new Map() } as any,
    });
    await app.ready();
    const a = await app.inject({ method: 'GET', url: `/reports/workflow?projectId=${PROJECT_ID}` });
    const b = await app.inject({ method: 'GET', url: `/reports/workflow-status?projectId=${PROJECT_ID}` });
    expect(a.statusCode).not.toBe(404);
    expect(b.statusCode).toBe(a.statusCode);
    expect(b.json()).toEqual(a.json());
  });
});
