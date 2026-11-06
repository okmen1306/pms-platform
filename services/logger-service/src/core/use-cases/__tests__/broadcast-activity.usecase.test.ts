import { describe, it, expect } from 'vitest';
import { broadcastActivity } from '../broadcast-activity.usecase';
import { SseBroadcaster } from '../../../infrastructure/realtime/sse-broadcaster';
import type { AuditEventRow } from '../../../infrastructure/database/audit.repository';
import type { FastifyReply } from 'fastify';

function fakeReply(writes: string[]): FastifyReply {
  return { raw: { write: (chunk: string) => writes.push(chunk) } } as unknown as FastifyReply;
}

function makeRow(overrides: Partial<AuditEventRow> = {}): AuditEventRow {
  return {
    id: 'audit-1',
    service: 'project-service',
    event_type: 'CREATE',
    actor_user_id: '11111111-1111-1111-1111-111111111111',
    actor_email: 'lider@example.com',
    entity_type: 'project_milestones',
    entity_id: '22222222-2222-2222-2222-222222222222',
    ozet: '"X" projesine "Y" kilometre taşı eklendi.',
    onceki_deger: null,
    yeni_deger: null,
    severity: 'info',
    ip_adresi: null,
    created_at: '2026-09-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('SseBroadcaster', () => {
  it('subscribe olan istemciye broadcast edilen veriyi yazar', () => {
    const broadcaster = new SseBroadcaster();
    const writes: string[] = [];
    broadcaster.subscribe(fakeReply(writes));
    broadcaster.broadcast({ hello: 'world' });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('data: {"hello":"world"}');
  });

  it('unsubscribe olan istemciye ARTIK yazmaz', () => {
    const broadcaster = new SseBroadcaster();
    const writes: string[] = [];
    const reply = fakeReply(writes);
    broadcaster.subscribe(reply);
    broadcaster.unsubscribe(reply);
    broadcaster.broadcast({ hello: 'world' });
    expect(writes).toHaveLength(0);
  });

  it('BİRDEN FAZLA istemciye aynı anda yayınlar', () => {
    const broadcaster = new SseBroadcaster();
    const writesA: string[] = [];
    const writesB: string[] = [];
    broadcaster.subscribe(fakeReply(writesA));
    broadcaster.subscribe(fakeReply(writesB));
    broadcaster.broadcast({ x: 1 });
    expect(writesA).toHaveLength(1);
    expect(writesB).toHaveLength(1);
  });

  it('clientCount doğru sayıyı yansıtır', () => {
    const broadcaster = new SseBroadcaster();
    const r1 = fakeReply([]);
    const r2 = fakeReply([]);
    broadcaster.subscribe(r1);
    broadcaster.subscribe(r2);
    expect(broadcaster.clientCount).toBe(2);
    broadcaster.unsubscribe(r1);
    expect(broadcaster.clientCount).toBe(1);
  });
});

describe('broadcastActivity', () => {
  it('audit satırını okunabilir bir SSE olayına çevirip yayınlar', () => {
    const broadcaster = new SseBroadcaster();
    const writes: string[] = [];
    broadcaster.subscribe(fakeReply(writes));

    broadcastActivity(makeRow(), broadcaster);

    expect(writes).toHaveLength(1);
    const payload = JSON.parse(writes[0].replace(/^data: /, '').trim());
    expect(payload.ozet).toBe('"X" projesine "Y" kilometre taşı eklendi.');
    expect(payload.service).toBe('project-service');
    expect(payload.severity).toBe('info');
  });

  it('critical severity de olduğu gibi yayınlanır', () => {
    const broadcaster = new SseBroadcaster();
    const writes: string[] = [];
    broadcaster.subscribe(fakeReply(writes));

    broadcastActivity(makeRow({ severity: 'critical', ozet: 'Gece yarısı toplu maaş görüntülemesi.' }), broadcaster);

    const payload = JSON.parse(writes[0].replace(/^data: /, '').trim());
    expect(payload.severity).toBe('critical');
  });
});
