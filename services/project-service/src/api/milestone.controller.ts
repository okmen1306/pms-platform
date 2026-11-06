import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, CreateMilestoneDtoSchema, type AuditPublisherFn } from '@pms/shared';
import { createMilestone } from '../core/use-cases/create-milestone.usecase';
import type { MilestoneRepository } from '../infrastructure/database/milestone.repository';
import type { ProjectRepository } from '../infrastructure/database/project.repository';

export interface MilestoneControllerDeps {
  milestoneRepo: MilestoneRepository;
  projectRepo: ProjectRepository;
  publishAudit: AuditPublisherFn;
}

/**
 * B1 (Day 9): docs/roadmap.md Bölüm 8 uç nokta listesinde SADECE bu iki route var
 * (`POST`/`GET /projects/:id/milestones`) — PATCH/DELETE yok, bu yüzden burada da yok
 * (bir kilometre taşı yanlış girildiyse bugünün kapsamında düzeltme/silme yolu yok).
 */
export function registerMilestoneRoutes(app: FastifyInstance, deps: MilestoneControllerDeps) {
  app.get('/projects/:id/milestones', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const items = await deps.milestoneRepo.findByProject(id);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/projects/:id/milestones', async (request) => {
    // RBAC (Day 21, G-01): gateway'de `project.records` edit ile zorlanır (ekip_lideri + sirket_yoneticisi; bkz. docs/testing/rbac-matrix.md).
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = CreateMilestoneDtoSchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await createMilestone(id, body, actorUserId, deps.milestoneRepo, deps.projectRepo, deps.publishAudit);
    return ok(created);
  });
}
