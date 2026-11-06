import type { FastifyInstance } from 'fastify';
import { ok } from '@pms/shared';
import type { AuditEventRepository } from '../infrastructure/database/audit.repository';
import { computeSystemPulse } from '../core/use-cases/compute-system-pulse.usecase';

/** Day 22 (G-04): `GET /admin/system-pulse`. RBAC (admin.audit_log) gateway'in `/logger/*` kapısında (diğer admin uçlarıyla aynı). */
export function registerSystemPulseRoutes(app: FastifyInstance, deps: { auditRepo: AuditEventRepository; now?: () => Date }) {
  app.get('/admin/system-pulse', async () => ok(await computeSystemPulse(deps.auditRepo, deps.now?.())));
}
