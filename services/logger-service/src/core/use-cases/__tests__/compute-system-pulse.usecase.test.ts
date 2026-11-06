import { describe, it, expect } from 'vitest';
import { computeSystemPulse, istanbulDayStart } from '../compute-system-pulse.usecase';
import type { AuditEventRepository, AuditPulseRow } from '../../../infrastructure/database/audit.repository';

const repoWith = (rows: AuditPulseRow[], truncated = false) =>
  ({ findSince: async (since: string) => ({ rows: rows.filter((r) => r.created_at >= since), truncated }) }) as unknown as AuditEventRepository;

const row = (created_at: string, over: Partial<AuditPulseRow> = {}): AuditPulseRow => ({
  event_type: 'UPDATE',
  severity: 'info',
  actor_user_id: null,
  created_at,
  ...over,
});

// 21 Ekim 2026 14:00 UTC = 17:00 İstanbul -> İstanbul günü 20 Ekim 21:00 UTC'de başlar.
const NOW = new Date('2026-10-21T14:00:00Z');

describe('system-pulse (Day 22, G-04)', () => {
  it('"bugün" İstanbul takvim günüdür (UTC+3): gece yarısından hemen önce/sonra ayrımı', () => {
    expect(istanbulDayStart(NOW).toISOString()).toBe('2026-10-20T21:00:00.000Z');
    // 22:30 UTC = 01:30 İstanbul ertesi gün
    expect(istanbulDayStart(new Date('2026-10-21T22:30:00Z')).toISOString()).toBe('2026-10-21T21:00:00.000Z');
  });

  it('bugünkü işlem sayısı ve farklı aktif kullanıcılar; actor\'suz (sistem) işlem kullanıcı sayılmaz', async () => {
    const p = await computeSystemPulse(
      repoWith([
        row('2026-10-21T10:00:00Z', { actor_user_id: 'a' }),
        row('2026-10-21T11:00:00Z', { actor_user_id: 'a' }),
        row('2026-10-21T12:00:00Z', { actor_user_id: 'b' }),
        row('2026-10-21T13:00:00Z'),
        row('2026-10-20T20:59:00Z', { actor_user_id: 'c' }), // dünün son dakikası (İstanbul) -> bugün DEĞİL
      ]),
      NOW,
    );
    expect(p.todayActions).toBe(4);
    expect(p.activeUsersToday).toBe(2);
  });

  it('son 24 saat: oluşan/silinen/uyarı (warning+critical)/izin değişikliği; 24 saatten eski sayılmaz', async () => {
    const p = await computeSystemPulse(
      repoWith([
        row('2026-10-21T13:00:00Z', { event_type: 'CREATE' }),
        row('2026-10-21T12:00:00Z', { event_type: 'DELETE', severity: 'warning' }),
        row('2026-10-21T11:00:00Z', { event_type: 'PERMISSION_CHANGE', severity: 'critical' }),
        row('2026-10-20T14:01:00Z', { event_type: 'CREATE' }), // 23s59dk önce -> dahil
        row('2026-10-20T13:59:00Z', { event_type: 'CREATE' }), // 24s01dk önce -> hariç
      ]),
      NOW,
    );
    expect(p.last24h).toEqual({ created: 2, deleted: 1, warnings: 2, permissionChanges: 1 });
  });

  it('geciken iş paketi 0 değil null (veri kaynağı yok); kesilen veri truncated bayrağıyla işaretlenir', async () => {
    const p = await computeSystemPulse(repoWith([], true), NOW);
    expect(p.delayedWorkPackages).toBeNull();
    expect(p.truncated).toBe(true);
    expect(p.todayActions).toBe(0);
  });
});
