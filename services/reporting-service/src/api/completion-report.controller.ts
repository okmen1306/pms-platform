import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok } from '@pms/shared';
import { buildCompletionSummary } from '../core/use-cases/build-completion-summary.usecase';
import type { ReportRepository } from '../infrastructure/database/report.repository';

const CompletionStatusQuerySchema = z.object({
  projectId: z.guid(),
  scope: z.enum(['project', 'work-package', 'employee']).default('project'),
});

/**
 * B3 (Day 11, B2 destekli): reporting-service'in İLK okuma (HTTP GET) uç noktası — Day 10'da
 * app.ts'te "okuma API'si bugünün kapsamında değil" notuyla bilinçli ertelenmişti.
 * api-gateway'in `/reporting` proxy'si zaten Day 10'dan beri hazır bekliyordu (sadece kimlik
 * doğrulama istiyor, roadmap.md'de reporting-service'e özel bir izin anahtarı planlı değil).
 */
export function registerCompletionReportRoutes(app: FastifyInstance, deps: { reportRepo: ReportRepository }) {
  app.get('/reports/completion-status', async (request) => {
    const { projectId, scope } = CompletionStatusQuerySchema.parse(request.query);
    const result = await buildCompletionSummary(projectId, scope, deps.reportRepo);
    return ok(result);
  });
}
