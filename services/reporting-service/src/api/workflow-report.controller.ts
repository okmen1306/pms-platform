import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { okList } from '@pms/shared';
import { buildGanttView } from '../core/use-cases/build-gantt-view.usecase';
import type { ReportRepository } from '../infrastructure/database/report.repository';
import type { ProjectServiceClient } from '../infrastructure/external/project-service.client';
import type { PersonnelServiceClient } from '../infrastructure/external/personnel-service.client';

const QuerySchema = z.object({ projectId: z.string().uuid() });

export function registerWorkflowReportRoutes(
  app: FastifyInstance,
  deps: { reportRepo: ReportRepository; projectServiceClient: ProjectServiceClient; personnelServiceClient: PersonnelServiceClient },
) {
  const handler = async (request: { query: unknown }) => {
    const { projectId } = QuerySchema.parse(request.query);
    const items = await buildGanttView(projectId, deps.reportRepo, deps.projectServiceClient, deps.personnelServiceClient);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  };
  // Day 21 (G-05): spec adı `/reports/workflow`. Eski `/reports/workflow-status` GEÇİCİ alias —
  // web (reporting.api.ts) yeni ada geçtiği için Day 22'de silinecek (CHANGELOG Day 21).
  app.get('/reports/workflow', handler);
  app.get('/reports/workflow-status', handler);
}
