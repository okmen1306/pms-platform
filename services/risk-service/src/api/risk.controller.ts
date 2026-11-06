import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, type AuditPublisherFn } from '@pms/shared';
import { createRisk } from '../core/use-cases/create-risk.usecase';
import { updateRisk } from '../core/use-cases/update-risk.usecase';
import { listRisksByProject } from '../core/use-cases/list-risks-by-project.usecase';
import type { RiskRepository } from '../infrastructure/database/risk.repository';

const CreateRiskBodySchema = z.object({
  workPackageId: z.string().uuid().optional(),
  subWorkPackageId: z.string().uuid().optional(),
  riskAdi: z.string().min(1),
  aciklama: z.string().optional(),
  olasilik: z.number().int().min(1).max(5),
  etki: z.number().int().min(1).max(5),
  azaltmaStratejisi: z.string().optional(),
});

const UpdateRiskBodySchema = z.object({
  riskAdi: z.string().min(1).optional(),
  aciklama: z.string().optional(),
  olasilik: z.number().int().min(1).max(5).optional(),
  etki: z.number().int().min(1).max(5).optional(),
  azaltmaStratejisi: z.string().optional(),
  durum: z.enum(['acik', 'izleniyor', 'kapandi']).optional(),
});

export function registerRiskRoutes(app: FastifyInstance, deps: { riskRepo: RiskRepository; publishAudit: AuditPublisherFn }) {
  app.get('/projects/:id/risks', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const items = await listRisksByProject(id, deps.riskRepo);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/projects/:id/risks', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = CreateRiskBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await createRisk(
      {
        project_id: id,
        work_package_id: body.workPackageId ?? null,
        sub_work_package_id: body.subWorkPackageId ?? null,
        risk_adi: body.riskAdi,
        aciklama: body.aciklama ?? null,
        olasilik: body.olasilik,
        etki: body.etki,
        azaltma_stratejisi: body.azaltmaStratejisi ?? null,
        olusturan_id: actorUserId,
      },
      deps.riskRepo,
      deps.publishAudit,
    );
    return ok(created);
  });

  app.patch('/risks/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = UpdateRiskBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const updated = await updateRisk(
      id,
      {
        risk_adi: body.riskAdi,
        aciklama: body.aciklama,
        olasilik: body.olasilik,
        etki: body.etki,
        azaltma_stratejisi: body.azaltmaStratejisi,
        durum: body.durum,
      },
      actorUserId,
      deps.riskRepo,
      deps.publishAudit,
    );
    return ok(updated);
  });

  app.delete('/risks/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await deps.riskRepo.delete(id);
    return ok({ deleted: true });
  });
}
