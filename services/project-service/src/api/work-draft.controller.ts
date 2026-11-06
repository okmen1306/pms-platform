import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, WorkDraftCellDtoSchema, type AuditPublisherFn } from '@pms/shared';
import { setWorkDraftCell } from '../core/use-cases/set-work-draft-cell.usecase';
import type { WorkDraftRepository } from '../infrastructure/database/work-draft.repository';
import type { ProjectRepository } from '../infrastructure/database/project.repository';

export interface WorkDraftControllerDeps {
  workDraftRepo: WorkDraftRepository;
  projectRepo: ProjectRepository;
  publishAudit: AuditPublisherFn;
}

/**
 * B1 (Day 10): roadmap.md Bölüm 8'de bu route'lar TANIMLI DEĞİL (bkz. 003_project_tables.sql
 * Day 10 notu) — isim/şekil Uzman İnisiyatifi ile, diğer proje alt-kaynaklarıyla (assignments,
 * milestones) TUTARLI kalacak şekilde seçildi.
 */
export function registerWorkDraftRoutes(app: FastifyInstance, deps: WorkDraftControllerDeps) {
  app.get('/projects/:id/work-draft', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const items = await deps.workDraftRepo.findByProject(id);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/projects/:id/work-draft', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = WorkDraftCellDtoSchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const cell = await setWorkDraftCell(id, body, actorUserId, deps.workDraftRepo, deps.projectRepo, deps.publishAudit);
    return ok(cell);
  });
}
