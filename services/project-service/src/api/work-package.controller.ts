import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, RabbitMqClient, PROJECT_EVENTS, type AuditPublisherFn } from '@pms/shared';
import { planWorkPackage } from '../core/use-cases/plan-work-packages.usecase';
import { addSubWorkPackage } from '../core/use-cases/add-sub-work-package.usecase';
import type { WorkPackageRepository } from '../infrastructure/database/work-package.repository';
import type { ProjectRepository } from '../infrastructure/database/project.repository';

const PlanWorkPackageBodySchema = z.object({
  masterWorkPackageId: z.number().int(),
  baslangicTarihi: z.string().date().optional(),
  bitisTarihi: z.string().date().optional(),
});

const AddSubWorkPackageBodySchema = z.object({
  ad: z.string().min(1),
  baslangicHafta: z.number().int().positive(),
  bitisHafta: z.number().int().positive(),
});

const UpdateSubWorkPackageBodySchema = z.object({
  ad: z.string().min(1).optional(),
  baslangicHafta: z.number().int().positive().optional(),
  bitisHafta: z.number().int().positive().optional(),
});

export interface WorkPackageControllerDeps {
  workPackageRepo: WorkPackageRepository;
  projectRepo: ProjectRepository;
  rabbit: RabbitMqClient;
  publishAudit: AuditPublisherFn;
}

export function registerWorkPackageRoutes(app: FastifyInstance, deps: WorkPackageControllerDeps) {
  app.get('/master-work-packages', async () => {
    const items = await deps.workPackageRepo.listMasterPackages();
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.get('/projects/:id/work-packages', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const items = await deps.workPackageRepo.listByProject(id);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/projects/:id/work-packages', async (request) => {
    // RBAC (Day 21, G-01): gateway'de `project.records` edit ile zorlanır (ekip_lideri + sirket_yoneticisi).
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const body = PlanWorkPackageBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await planWorkPackage(
      id,
      body,
      actorUserId,
      deps.workPackageRepo,
      deps.projectRepo,
      deps.publishAudit,
      (event) => deps.rabbit.publish(PROJECT_EVENTS.WORK_PACKAGE_PLANNED, event),
    );
    return ok(created);
  });

  app.post('/work-packages/:id/sub-work-packages', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const body = AddSubWorkPackageBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await addSubWorkPackage(id, body, actorUserId, deps.workPackageRepo, deps.publishAudit);
    return ok(created);
  });

  app.get('/work-packages/:id/sub-work-packages', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const items = await deps.workPackageRepo.listSubWorkPackages(id);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.patch('/sub-work-packages/:id', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const body = UpdateSubWorkPackageBodySchema.parse(request.body);
    const updated = await deps.workPackageRepo.updateSubWorkPackage(id, {
      ad: body.ad,
      baslangic_hafta: body.baslangicHafta,
      bitis_hafta: body.bitisHafta,
    });
    return ok(updated);
  });

  app.delete('/sub-work-packages/:id', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    await deps.workPackageRepo.deleteSubWorkPackage(id);
    return ok({ deleted: true });
  });
}
