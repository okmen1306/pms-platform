import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { okList } from '@pms/shared';
import type { PerformanceServiceClient } from '../infrastructure/external/performance-service.client';

const QuerySchema = z.object({ projectId: z.string().uuid() });

export function registerTeamPerformanceReportRoutes(app: FastifyInstance, deps: { performanceServiceClient: PerformanceServiceClient }) {
  app.get('/reports/team-performance', async (request) => {
    const { projectId } = QuerySchema.parse(request.query);
    const items = await deps.performanceServiceClient.getTeamIndices(projectId);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });
}
