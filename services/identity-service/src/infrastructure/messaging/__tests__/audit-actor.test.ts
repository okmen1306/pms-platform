import { describe, it, expect, vi } from 'vitest';
import { withActorEmail } from '../audit-actor';

const base = { eventType: 'CREATE' as const, entityType: 'x', entityId: null, ozet: 'o', severity: 'info' as const };
const repo = (email: string | null | 'throw') => ({
  findById: vi.fn(async () => {
    if (email === 'throw') throw new Error('db');
    return email ? ({ email } as never) : null;
  }),
});

describe('withActorEmail (Day 22: akışta admin "sistem" görünmesin)', () => {
  it('actorEmail null + actorUserId varsa e-postayı kendi kullanıcı tablosundan çözer', async () => {
    const publish = vi.fn(async () => {});
    await withActorEmail(publish, repo('admin@acme.test'))({ ...base, actorUserId: 'u1', actorEmail: null });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 'u1', actorEmail: 'admin@acme.test' }));
  });
  it('e-posta zaten varsa aramaz', async () => {
    const r = repo('baska@acme.test');
    const publish = vi.fn(async () => {});
    await withActorEmail(publish, r)({ ...base, actorUserId: 'u1', actorEmail: 'verilen@acme.test' });
    expect(r.findById).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ actorEmail: 'verilen@acme.test' }));
  });
  it('actorUserId yoksa (sistem işlemi) aramaz, null kalır', async () => {
    const r = repo('x@y.z');
    const publish = vi.fn(async () => {});
    await withActorEmail(publish, r)({ ...base, actorUserId: null, actorEmail: null });
    expect(r.findById).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ actorEmail: null }));
  });
  it('arama hata verirse / kullanıcı yoksa audit YİNE yayınlanır (e-posta null)', async () => {
    for (const mode of ['throw', null] as const) {
      const publish = vi.fn(async () => {});
      await withActorEmail(publish, repo(mode))({ ...base, actorUserId: 'u1', actorEmail: null });
      expect(publish).toHaveBeenCalledWith(expect.objectContaining({ actorEmail: null }));
    }
  });
});
