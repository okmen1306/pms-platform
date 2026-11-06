import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { okList } from '@pms/shared';
import { buildWorkloadMatrix } from '../core/use-cases/build-workload-matrix.usecase';
import type { ReportRepository } from '../infrastructure/database/report.repository';
import type { ProjectServiceClient } from '../infrastructure/external/project-service.client';
import type { PersonnelServiceClient } from '../infrastructure/external/personnel-service.client';

const QuerySchema = z.object({ projectId: z.guid() });

export function registerWorkDetailRoutes(
  app: FastifyInstance,
  deps: { reportRepo: ReportRepository; projectServiceClient: ProjectServiceClient; personnelServiceClient: PersonnelServiceClient },
) {
  app.get('/reports/work-detail', async (request) => {
    const { projectId } = QuerySchema.parse(request.query);
    const items = await buildWorkloadMatrix(projectId, deps.reportRepo, deps.projectServiceClient, deps.personnelServiceClient);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });
}
