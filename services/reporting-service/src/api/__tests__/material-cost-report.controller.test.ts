import Fastify from 'fastify';
import { describe, it, expect } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerMaterialCostReportRoutes } from '../material-cost-report.controller';
import type { FinanceServiceClient } from '../../infrastructure/external/finance-service.client';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';

describe('GET /reports/material-cost (B3, Day 12 — finance-service\'e ince proxy)', () => {
  it('finance-service\'ten dönen malzeme maliyetini olduğu gibi geçirir', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    const financeServiceClient = {
      getMaterialCost: async () => ({ malzemeMaliyetiTl: 15000, malzemeMaliyetiUsd: 450 }),
    } as unknown as FinanceServiceClient;
    registerMaterialCostReportRoutes(app, { financeServiceClient });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: `/reports/material-cost?projectId=${PROJECT_ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ malzemeMaliyetiTl: 15000, malzemeMaliyetiUsd: 450 });
  });

  it('projectId geçersizse 422 döner', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    registerMaterialCostReportRoutes(app, { financeServiceClient: {} as unknown as FinanceServiceClient });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/reports/material-cost?projectId=gecersiz' });
    expect(res.statusCode).toBe(422);
  });
});
