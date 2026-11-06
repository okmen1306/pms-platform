import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, NotFoundError, PaginationQuerySchema } from '@pms/shared';
import type { AuditEventRepository } from '../infrastructure/database/audit.repository';

const AuditLogQuerySchema = PaginationQuerySchema.extend({
  service: z.string().min(1).optional(),
  entityType: z.string().min(1).optional(),
  actorUserId: z.guid().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});

/**
 * TL (Day 11): "logger-service tamamlama". RBAC (admin.audit_log) burada DEĞİL —
 * activity-stream.controller.ts'teki AYNI mantık: api-gateway'in `/logger/*` proxy'si zaten
 * bunu istiyor (bkz. api-gateway/src/routes/logger.routes.ts). roadmap.md satır ~1559'daki
 * uç nokta imzasıyla BİREBİR: `GET /admin/audit-log?service=&entityType=&actorUserId=&severity=&from=&to=&page=`
 * + `GET /admin/audit-log/:id`.
 */
export function registerAuditLogRoutes(app: FastifyInstance, deps: { auditRepo: AuditEventRepository }) {
  app.get('/admin/audit-log', async (request) => {
    const { page, pageSize, ...filters } = AuditLogQuerySchema.parse(request.query);
    const { items, total } = await deps.auditRepo.list(filters, { page, pageSize });
    return okList(items, { page, pageSize, total });
  });

  app.get('/admin/audit-log/:id', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const found = await deps.auditRepo.findById(id);
    if (!found) throw new NotFoundError('Denetim kaydı', id);
    return ok(found);
  });
}
