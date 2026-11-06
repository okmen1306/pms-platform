import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, type AuditPublisherFn } from '@pms/shared';
import { assignEmployeeToTeam } from '../core/use-cases/assign-employee-to-team.usecase';
import { getEmployeeTeamsAndRoles } from '../core/use-cases/get-employee-teams-and-roles.usecase';
import type { TeamRepository } from '../infrastructure/database/team.repository';
import type { EmployeeRepository } from '../infrastructure/database/employee.repository';

const CreateTeamBodySchema = z.object({ ad: z.string().min(1), aciklama: z.string().optional() });
const AddMemberBodySchema = z.object({ employeeId: z.string().uuid(), sorumluluk: z.string().optional() });

export interface TeamControllerDeps {
  teamRepo: TeamRepository;
  employeeRepo: EmployeeRepository;
  publishAudit: AuditPublisherFn;
}

export function registerTeamRoutes(app: FastifyInstance, deps: TeamControllerDeps) {
  app.get('/teams', async () => {
    const items = await deps.teamRepo.findAll();
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/teams', async (request) => {
    // RBAC (Day 21, G-01): gateway'de `personnel.records` edit ile zorlanır (sirket_yoneticisi + ik_yoneticisi; "yalnızca sirket_yoneticisi" daha dar olurdu — G-22).
    const body = CreateTeamBodySchema.parse(request.body);
    const created = await deps.teamRepo.create(body.ad, body.aciklama);
    return ok(created);
  });

  app.post('/teams/:id/members', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = AddMemberBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const result = await assignEmployeeToTeam(
      id,
      body.employeeId,
      body.sorumluluk,
      actorUserId,
      deps.teamRepo,
      deps.employeeRepo,
      deps.publishAudit,
    );
    return ok(result);
  });

  app.get('/teams/:id/members', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const items = await deps.teamRepo.listMembers(id);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.get('/employees/:id/teams', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const items = await getEmployeeTeamsAndRoles(id, deps.teamRepo);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });
}
