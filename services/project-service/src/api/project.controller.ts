import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, RabbitMqClient, PROJECT_EVENTS, type AuditPublisherFn } from '@pms/shared';
import { createProject } from '../core/use-cases/create-project.usecase';
import { updateProject } from '../core/use-cases/update-project.usecase';
import type { WeeklyAllocationRepository } from '../infrastructure/database/weekly-allocation.repository';
import type { ProjectRepository } from '../infrastructure/database/project.repository';
import type { ProductCatalogRepository } from '../infrastructure/database/product-catalog.repository';
import type { IntegrationServiceClient } from '../infrastructure/external/integration-service.client';

const CreateProjectBodySchema = z.object({
  projeAdi: z.string().min(2),
  baslangicTarihi: z.string().date(),
  bitisTarihi: z.string().date(),
  productGroupId: z.guid(),
  productId: z.guid(),
  ekipLideriId: z.guid(),
  tahminiMaliyetTl: z.number().positive().optional(),
  satisFiyatiTl: z.number().positive().optional(),
  danismanlikMaliyetiTl: z.number().min(0).optional(),
  paketlemeGonderimMaliyetiTl: z.number().min(0).optional(),
  idariMaliyetOrani: z.number().min(0).max(1).optional(),
});

const UpdateProjectBodySchema = CreateProjectBodySchema.pick({
  projeAdi: true,
  baslangicTarihi: true,
  bitisTarihi: true,
  ekipLideriId: true,
  tahminiMaliyetTl: true,
  satisFiyatiTl: true,
  danismanlikMaliyetiTl: true,
  paketlemeGonderimMaliyetiTl: true,
  idariMaliyetOrani: true,
}).partial();

export interface ProjectControllerDeps {
  projectRepo: ProjectRepository;
  allocationRepo: WeeklyAllocationRepository;
  catalogRepo: ProductCatalogRepository;
  integrationClient: IntegrationServiceClient;
  rabbit: RabbitMqClient;
  publishAudit: AuditPublisherFn;
}

export function registerProjectRoutes(app: FastifyInstance, deps: ProjectControllerDeps) {
  app.get('/projects', async (request) => {
    const { durum, ekipLideriId } = z
      .object({ durum: z.string().optional(), ekipLideriId: z.guid().optional() })
      .parse(request.query);
    const items = await deps.projectRepo.findAll({ durum, ekipLideriId });
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.get('/projects/:id', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const project = await deps.projectRepo.findById(id);
    return ok(project);
  });

  app.post('/projects', async (request) => {
    // RBAC (Day 21, G-01): gateway'de `project.records` edit ile zorlanır. `satis` rolü kaldırıldı (karar: yetkisi sirket_yoneticisi'nde); AÇIK: ekip_lideri de bu anahtarla proje OLUŞTURABİLİR — CHANGELOG Day 21 G-22.
    const body = CreateProjectBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await createProject(
      body,
      actorUserId,
      deps.projectRepo,
      deps.catalogRepo,
      deps.integrationClient,
      deps.publishAudit,
      (event) => deps.rabbit.publish(PROJECT_EVENTS.CREATED, event),
    );
    return ok(created);
  });

  app.patch('/projects/:id', async (request) => {
    // TODO (G-01, Day 21): ekip_lideri + sirket_yoneticisi (gateway project.edit izni)
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const body = UpdateProjectBodySchema.parse(request.body ?? {});
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const updated = await updateProject(
      id,
      body,
      actorUserId,
      deps.projectRepo,
      deps.allocationRepo,
      deps.integrationClient,
      deps.publishAudit,
    );
    return ok(updated);
  });
}
