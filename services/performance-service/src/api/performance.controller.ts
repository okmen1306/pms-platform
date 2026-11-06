import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, type AuditPublisherFn } from '@pms/shared';
import { createCriterion, listCriteria } from '../core/use-cases/manage-criteria.usecase';
import { scoreEmployee } from '../core/use-cases/score-employee.usecase';
import { scoreTeamLead, overrideTeamLeadScore } from '../core/use-cases/score-team-lead.usecase';
import type { PerformanceScoreRepository } from '../infrastructure/database/score.repository';

const CreateCriterionSchema = z.object({ ad: z.string().min(1), agirlikYuzdesi: z.number().positive().max(100) });
const ScoreEmployeeSchema = z.object({ criterionId: z.string().uuid(), puan: z.number().min(0).max(100) });
const ScoreTeamLeadSchema = z.object({ criterionId: z.string().uuid(), puan: z.number().min(0).max(100) });
const OverrideTeamLeadScoreSchema = z.object({ puan: z.number().min(0).max(100) });
const PerformanceIndexQuerySchema = z.object({ scope: z.enum(['employee', 'team']).default('employee') });

export function registerPerformanceRoutes(
  app: FastifyInstance,
  deps: { scoreRepo: PerformanceScoreRepository; publishAudit: AuditPublisherFn },
) {
  app.get('/criteria', async () => {
    const items = await listCriteria(deps.scoreRepo);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/criteria', async (request) => {
    const body = CreateCriterionSchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await createCriterion(body, actorUserId, deps.scoreRepo, deps.publishAudit);
    return ok(created);
  });

  app.post('/projects/:projectId/employees/:employeeId/scores', async (request) => {
    const { projectId, employeeId } = z
      .object({ projectId: z.string().uuid(), employeeId: z.string().uuid() })
      .parse(request.params);
    const body = ScoreEmployeeSchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const result = await scoreEmployee(
      { projectId, employeeId, criterionId: body.criterionId, puan: body.puan },
      actorUserId,
      deps.scoreRepo,
      deps.publishAudit,
    );
    return ok(result);
  });

  // F2 (Day 10): "Performance tamamlama" — EmployeePerformancePage için.
  app.get('/projects/:projectId/employees/:employeeId/scores', async (request) => {
    const { projectId, employeeId } = z
      .object({ projectId: z.string().uuid(), employeeId: z.string().uuid() })
      .parse(request.params);
    const items = await deps.scoreRepo.listScoresByEmployee(projectId, employeeId);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  // TL (Day 12): "performance endeks hesaplama finalize" — roadmap.md Bölüm 8.
  app.post('/projects/:projectId/team-leads/:leadId/scores', async (request) => {
    const { projectId, leadId } = z.object({ projectId: z.string().uuid(), leadId: z.string().uuid() }).parse(request.params);
    const body = ScoreTeamLeadSchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const result = await scoreTeamLead(
      { projectId, ekipLideriId: leadId, criterionId: body.criterionId, puan: body.puan },
      actorUserId,
      deps.scoreRepo,
      deps.publishAudit,
    );
    return ok(result);
  });

  app.patch('/team-leads/:leadId/scores/:scoreId', async (request) => {
    const { scoreId } = z.object({ leadId: z.string().uuid(), scoreId: z.string().uuid() }).parse(request.params);
    const body = OverrideTeamLeadScoreSchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const result = await overrideTeamLeadScore(scoreId, body.puan, actorUserId, deps.scoreRepo, deps.publishAudit);
    return ok(result);
  });

  // scope=employee|team — takım endeksi = ekip_lideri_id'ye göre (bkz. score.repository.ts'teki
  // TeamIndexRow notu). Ayrı bir use-case katmanı yok (audit-log.controller.ts'teki (Day 11)
  // AYNI kalıp — saf, dallanmalı okuma).
  app.get('/projects/:projectId/performance-index', async (request) => {
    const { projectId } = z.object({ projectId: z.string().uuid() }).parse(request.params);
    const { scope } = PerformanceIndexQuerySchema.parse(request.query);
    if (scope === 'employee') {
      const items = await deps.scoreRepo.listEmployeeIndicesByProject(projectId);
      return okList(items, { page: 1, pageSize: items.length, total: items.length });
    }
    const items = await deps.scoreRepo.listTeamIndicesByProject(projectId);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  // "kendi endeksi" — bkz. docs/roadmap.md satır 1777 (Kendi endeksini gorur RLS'i).
  app.get('/employees/:employeeId/performance-index', async (request) => {
    const { employeeId } = z.object({ employeeId: z.string().uuid() }).parse(request.params);
    const items = await deps.scoreRepo.listEmployeeIndicesByEmployee(employeeId);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });
}
