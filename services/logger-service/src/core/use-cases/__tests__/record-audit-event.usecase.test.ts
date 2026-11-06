import { describe, it, expect } from 'vitest';
import { recordAuditEvent } from '../record-audit-event.usecase';
import type { AuditEventRepository, AuditEventRow, CreateAuditEventRow } from '../../../infrastructure/database/audit.repository';
import type { AuditEvent } from '@pms/shared';

class InMemoryAuditEventRepository implements AuditEventRepository {
  public inserted: CreateAuditEventRow[] = [];

  async insert(row: CreateAuditEventRow): Promise<AuditEventRow> {
    this.inserted.push(row);
    return { id: `audit-${this.inserted.length}`, created_at: new Date().toISOString(), ...row } as AuditEventRow;
  }
}

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    service: 'project-service',
    eventType: 'CREATE',
    actorUserId: '11111111-1111-1111-1111-111111111111',
    actorEmail: 'ekip.lideri@example.com',
    entityType: 'project_projects',
    entityId: '22222222-2222-2222-2222-222222222222',
    ozet: '"Yeni Proje" oluşturuldu.',
    severity: 'info',
    ...overrides,
  };
}

describe('recordAuditEvent', () => {
  it('camelCase event alanlarını doğru şekilde snake_case DB satırına eşler', async () => {
    const repo = new InMemoryAuditEventRepository();
    await recordAuditEvent(makeEvent(), repo);

    expect(repo.inserted).toHaveLength(1);
    expect(repo.inserted[0]).toMatchObject({
      service: 'project-service',
      event_type: 'CREATE',
      actor_user_id: '11111111-1111-1111-1111-111111111111',
      actor_email: 'ekip.lideri@example.com',
      entity_type: 'project_projects',
      entity_id: '22222222-2222-2222-2222-222222222222',
      ozet: '"Yeni Proje" oluşturuldu.',
      severity: 'info',
    });
  });

  it('actorUserId null olabilir (örn. sistem tarafından tetiklenen bir olay)', async () => {
    const repo = new InMemoryAuditEventRepository();
    await recordAuditEvent(makeEvent({ actorUserId: null, actorEmail: null }), repo);
    expect(repo.inserted[0].actor_user_id).toBeNull();
  });

  it('oncekiDeger/yeniDeger verilmemişse null olarak kaydedilir', async () => {
    const repo = new InMemoryAuditEventRepository();
    await recordAuditEvent(makeEvent(), repo);
    expect(repo.inserted[0].onceki_deger).toBeNull();
    expect(repo.inserted[0].yeni_deger).toBeNull();
  });

  it('oncekiDeger/yeniDeger verilmişse (UPDATE olayı) aynen kaydedilir', async () => {
    const repo = new InMemoryAuditEventRepository();
    await recordAuditEvent(
      makeEvent({
        eventType: 'UPDATE',
        oncekiDeger: { durum: 'yeni' },
        yeniDeger: { durum: 'devam_ediyor' },
      }),
      repo,
    );
    expect(repo.inserted[0].onceki_deger).toEqual({ durum: 'yeni' });
    expect(repo.inserted[0].yeni_deger).toEqual({ durum: 'devam_ediyor' });
  });

  it('severity: critical olayları da olduğu gibi kaydeder (örn. gece yarısı maaş görüntüleme)', async () => {
    const repo = new InMemoryAuditEventRepository();
    await recordAuditEvent(makeEvent({ eventType: 'VIEW_SENSITIVE', severity: 'warning' }), repo);
    expect(repo.inserted[0].severity).toBe('warning');
  });

  it('kaydedilen satırı (id ile birlikte) geri döner', async () => {
    const repo = new InMemoryAuditEventRepository();
    const result = await recordAuditEvent(makeEvent(), repo);
    expect(result.id).toBe('audit-1');
  });
});
