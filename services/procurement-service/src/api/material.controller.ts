import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, RabbitMqClient, PROCUREMENT_EVENTS, type AuditPublisherFn } from '@pms/shared';
import { registerMaterialPurchase } from '../core/use-cases/register-material-purchase.usecase';
import { overrideExchangeRate } from '../core/use-cases/override-exchange-rate.usecase';
import { recordStockMovement } from '../core/use-cases/record-stock-movement.usecase';
import type { MaterialRepository } from '../infrastructure/database/material.repository';
import type { StockMovementRepository } from '../infrastructure/database/stock-movement.repository';
import type { IntegrationServiceClient } from '../infrastructure/external/integration-service.client';

const CreateMaterialBodySchema = z.object({
  projectId: z.guid(),
  malzemeTuru: z.string().min(1),
  malzemeAdi: z.string().min(1),
  teknikOzellik: z.string().optional(),
  adet: z.number().positive(),
  birimFiyat: z.number().min(0),
  alimTarihi: z.string().date(),
  manuelKur: z.number().positive().optional(),
});

const StockMovementBodySchema = z.object({
  hareketTipi: z.enum(['giris', 'cikis']),
  miktar: z.number().positive(),
  aciklama: z.string().optional(),
});

export interface MaterialControllerDeps {
  materialRepo: MaterialRepository;
  stockMovementRepo: StockMovementRepository;
  integrationClient: IntegrationServiceClient;
  rabbit: RabbitMqClient;
  publishAudit: AuditPublisherFn;
}

export function registerMaterialRoutes(app: FastifyInstance, deps: MaterialControllerDeps) {
  app.get('/materials', async (request) => {
    const { projectId } = z.object({ projectId: z.guid() }).parse(request.query);
    const items = await deps.materialRepo.listByProject(projectId);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/materials', async (request) => {
    // RBAC (Day 21, G-01): gateway'de `procurement.materials` edit ile zorlanır (satinalma_personeli + sirket_yoneticisi).
    const body = CreateMaterialBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await registerMaterialPurchase(
      body,
      actorUserId,
      deps.materialRepo,
      deps.integrationClient,
      deps.publishAudit,
      (event) => deps.rabbit.publish(PROCUREMENT_EVENTS.MATERIAL_PURCHASED, event),
    );
    return ok(created);
  });

  app.patch('/materials/:id/override-rate', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const { newRate } = z.object({ newRate: z.number().positive() }).parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const updated = await overrideExchangeRate(id, newRate, actorUserId, deps.materialRepo, deps.publishAudit);
    return ok(updated);
  });

  app.get('/materials/:id/stock-movements', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const [items, currentStock] = await Promise.all([
      deps.stockMovementRepo.listByMaterial(id),
      deps.stockMovementRepo.currentStock(id),
    ]);
    return ok({ items, currentStock });
  });

  app.post('/materials/:id/stock-movements', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const body = StockMovementBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await recordStockMovement(
      id,
      body.hareketTipi,
      body.miktar,
      body.aciklama,
      actorUserId,
      deps.stockMovementRepo,
      deps.publishAudit,
    );
    return ok(created);
  });
}
