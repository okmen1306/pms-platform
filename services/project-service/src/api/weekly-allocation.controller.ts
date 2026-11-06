import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, type AuditPublisherFn } from '@pms/shared';
import { allocateTeamWeekly } from '../core/use-cases/allocate-team-weekly.usecase';
import type { WeeklyAllocationRepository } from '../infrastructure/database/weekly-allocation.repository';
import type { ProjectRepository } from '../infrastructure/database/project.repository';

const AllocateBodySchema = z.object({
  teamId: z.guid(),
  haftaNo: z.number().int().positive(),
  planlananSureHafta: z.number().positive(),
});

export interface WeeklyAllocationControllerDeps {
  allocationRepo: WeeklyAllocationRepository;
  projectRepo: ProjectRepository;
  publishAudit: AuditPublisherFn;
}

export function registerWeeklyAllocationRoutes(app: FastifyInstance, deps: WeeklyAllocationControllerDeps) {
  app.get('/projects/:id/weekly-allocation', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const items = await deps.allocationRepo.listByProject(id);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/projects/:id/weekly-allocation', async (request) => {
    // RBAC (Day 21, G-01): gateway'de `project.records` edit ile zorlanır (ekip_lideri + sirket_yoneticisi).
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const body = AllocateBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await allocateTeamWeekly(
      id,
      body.teamId,
      body.haftaNo,
      body.planlananSureHafta,
      actorUserId,
      deps.allocationRepo,
      deps.projectRepo,
      deps.publishAudit,
    );
    return ok(created);
  });
}
