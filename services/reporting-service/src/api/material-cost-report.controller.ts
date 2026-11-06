import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok } from '@pms/shared';
import type { FinanceServiceClient } from '../infrastructure/external/finance-service.client';

const QuerySchema = z.object({ projectId: z.guid() });

/**
 * B3 (Day 12): "material-cost-report.controller.ts" — ince proxy, bkz. finance-service.client.ts.
 * Ayrı bir use-case YOK (roadmap dosya ağacında bu endpoint için bir use-case planlanmamış).
 */
export function registerMaterialCostReportRoutes(app: FastifyInstance, deps: { financeServiceClient: FinanceServiceClient }) {
  app.get('/reports/material-cost', async (request) => {
    const { projectId } = QuerySchema.parse(request.query);
    const cost = await deps.financeServiceClient.getMaterialCost(projectId);
    return ok(cost);
  });
}
