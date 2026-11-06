import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerAuditLogRoutes } from '../audit-log.controller';
import type {
  AuditEventRepository,
  AuditEventRow,
  CreateAuditEventRow,
  AuditEventFilters,
  AuditEventListResult,
} from '../../infrastructure/database/audit.repository';

/** cost-analysis.controller.test.ts (Day 10) ile AYNI kalıp — sahte, bellek içi repo. */
class InMemoryAuditEventRepository implements AuditEventRepository {
  private rows: AuditEventRow[] = [];

  seed(row: Partial<AuditEventRow> & Pick<AuditEventRow, 'service' | 'event_type' | 'ozet' | 'severity'>): AuditEventRow {
    const full: AuditEventRow = {
      id: randomUUID(),
      service: row.service,
      event_type: row.event_type,
      actor_user_id: row.actor_user_id ?? null,
      actor_email: row.actor_email ?? null,
      entity_type: row.entity_type ?? null,
      entity_id: row.entity_id ?? null,
      ozet: row.ozet,
      onceki_deger: row.onceki_deger ?? null,
      yeni_deger: row.yeni_deger ?? null,
      severity: row.severity,
      ip_adresi: row.ip_adresi ?? null,
      created_at: row.created_at ?? new Date().toISOString(),
    };
    this.rows.push(full);
    return full;
  }

  async insert(row: CreateAuditEventRow): Promise<AuditEventRow> {
    return this.seed(row);
  }

  async list(filters: AuditEventFilters, pagination: { page: number; pageSize: number }): Promise<AuditEventListResult> {
    let filtered = [...this.rows];
    if (filters.service) filtered = filtered.filter((r) => r.service === filters.service);
    if (filters.entityType) filtered = filtered.filter((r) => r.entity_type === filters.entityType);
    if (filters.actorUserId) filtered = filtered.filter((r) => r.actor_user_id === filters.actorUserId);
    if (filters.severity) filtered = filtered.filter((r) => r.severity === filters.severity);
    if (filters.from) filtered = filtered.filter((r) => r.created_at >= filters.from!);
    if (filters.to) filtered = filtered.filter((r) => r.created_at <= filters.to!);
    filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const total = filtered.length;
    const start = (pagination.page - 1) * pagination.pageSize;
    const items = filtered.slice(start, start + pagination.pageSize);
    return { items, total };
  }

  async findSince(since: string, limit: number) {
    const rows = this.rows.filter((r) => r.created_at >= since);
    return { rows: rows.slice(0, limit), truncated: rows.length > limit };
  }

  async findById(id: string): Promise<AuditEventRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }
}

describe('logger-service admin audit-log controller (TL, Day 11)', () => {
  let app: FastifyInstance;
  let repo: InMemoryAuditEventRepository;

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandler(app);
    repo = new InMemoryAuditEventRepository();
    registerAuditLogRoutes(app, { auditRepo: repo });
    await app.ready();
  });

  it('GET /admin/audit-log — kayıt yoksa boş liste + total:0 döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/audit-log' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toEqual([]);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 20, total: 0 });
  });

  it('GET /admin/audit-log — filtresiz tüm kayıtları en yeniden eskiye sıralı döner', async () => {
    repo.seed({ service: 'finance-service', event_type: 'CREATE', ozet: 'a', severity: 'info', created_at: '2026-09-01T10:00:00Z' });
    repo.seed({ service: 'project-service', event_type: 'UPDATE', ozet: 'b', severity: 'warning', created_at: '2026-09-02T10:00:00Z' });
    const res = await app.inject({ method: 'GET', url: '/admin/audit-log' });
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].ozet).toBe('b');
    expect(body.meta.total).toBe(2);
  });

  it('GET /admin/audit-log?service= — servise göre filtreler', async () => {
    repo.seed({ service: 'finance-service', event_type: 'CREATE', ozet: 'a', severity: 'info' });
    repo.seed({ service: 'project-service', event_type: 'UPDATE', ozet: 'b', severity: 'warning' });
    const res = await app.inject({ method: 'GET', url: '/admin/audit-log?service=finance-service' });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].service).toBe('finance-service');
  });

  it('GET /admin/audit-log?severity= — önem derecesine göre filtreler', async () => {
    repo.seed({ service: 'finance-service', event_type: 'DELETE', ozet: 'a', severity: 'critical' });
    repo.seed({ service: 'finance-service', event_type: 'CREATE', ozet: 'b', severity: 'info' });
    const res = await app.inject({ method: 'GET', url: '/admin/audit-log?severity=critical' });
    expect(res.json().data).toHaveLength(1);
  });

  it('GET /admin/audit-log?actorUserId= — geçersiz UUID 422 döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/audit-log?actorUserId=gecersiz' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /admin/audit-log?page=&pageSize= — sayfalama meta doğru döner', async () => {
    for (let i = 0; i < 5; i += 1) {
      repo.seed({ service: 'finance-service', event_type: 'CREATE', ozet: `kayit-${i}`, severity: 'info' });
    }
    const res = await app.inject({ method: 'GET', url: '/admin/audit-log?page=2&pageSize=2' });
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({ page: 2, pageSize: 2, total: 5 });
  });

  it('GET /admin/audit-log/:id — kayıt varsa 200 döner', async () => {
    const created = repo.seed({ service: 'finance-service', event_type: 'CREATE', ozet: 'a', severity: 'info' });
    const res = await app.inject({ method: 'GET', url: `/admin/audit-log/${created.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(created.id);
  });

  it('GET /admin/audit-log/:id — kayıt yoksa 404 döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/admin/audit-log/${randomUUID()}` });
    expect(res.statusCode).toBe(404);
  });

  it('GET /admin/audit-log/:id — geçersiz id formatı 422 döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/audit-log/gecersiz-id' });
    expect(res.statusCode).toBe(422);
  });
});
