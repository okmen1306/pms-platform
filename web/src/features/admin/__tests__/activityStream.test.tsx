import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import type { ActivityItem } from '../activity.api';

const backfill = vi.fn(async (_from: string): Promise<ActivityItem[]> => []);
vi.mock('../activity.api', async (orig) => ({ ...(await orig<typeof import('../activity.api')>()), fetchAuditSince: (f: string) => backfill(f) }));

import { mergeActivity, parseActivityData, parseSseChunk, useActivityStream, MAX_ITEMS } from '../useActivityStream';
import { describeChanges } from '../ActivityFeedPage';
import { actorLabel } from '../activity.api';

const item = (id: string, createdAt: string, over: Partial<ActivityItem> = {}): ActivityItem => ({
  id,
  service: 'identity',
  eventType: 'CREATE',
  actorUserId: 'u-1',
  actorEmail: 'a@b.c',
  entityType: null,
  entityId: null,
  ozet: `olay ${id}`,
  severity: 'info',
  createdAt,
  ...over,
});
const sse = (i: ActivityItem) => `data: ${JSON.stringify(i)}\n\n`;

describe('parseSseChunk', () => {
  it('yorum/keep-alive satırlarını atar, tam olayları döner, yarım olayı rest olarak bırakır', () => {
    const { events, rest } = parseSseChunk(':ok\n\ndata: {"a":1}\n\ndata: {"b"');
    expect(events).toEqual([{ id: undefined, data: '{"a":1}' }]);
    expect(rest).toBe('data: {"b"');
  });
  it('CRLF, id: satırı ve çok satırlı data birleştirilir', () => {
    const { events } = parseSseChunk('id: 7\r\ndata: x\r\ndata: y\r\n\r\n');
    expect(events).toEqual([{ id: '7', data: 'x\ny' }]);
  });
  it('bozuk JSON / eksik alan -> null (akışı çökertmez)', () => {
    expect(parseActivityData('{bozuk')).toBeNull();
    expect(parseActivityData('{"x":1}')).toBeNull();
    expect(parseActivityData(JSON.stringify({ id: 'i', createdAt: 't', severity: 'garip' }))?.severity).toBe('info');
  });
});

describe('actorLabel', () => {
  it('e-posta > kısaltılmış kimlik > sistem', () => {
    expect(actorLabel({ actorEmail: 'a@b.c', actorUserId: 'x' })).toBe('a@b.c');
    expect(actorLabel({ actorEmail: null, actorUserId: '12345678-aaaa' })).toBe('kullanıcı 12345678');
    expect(actorLabel({ actorEmail: null, actorUserId: null })).toBe('sistem');
  });
});

describe('mergeActivity', () => {
  it('id\'ye göre tekilleştirir, yeniden eskiye sıralar, MAX_ITEMS ile keser', () => {
    const merged = mergeActivity([item('1', '2026-10-21T10:00:00Z')], [item('1', '2026-10-21T10:00:00Z'), item('2', '2026-10-21T11:00:00Z')]);
    expect(merged.map((i) => i.id)).toEqual(['2', '1']);
    const many = Array.from({ length: MAX_ITEMS + 20 }, (_, n) => item(String(n), new Date(2026, 9, 21, 0, 0, n).toISOString()));
    expect(mergeActivity([], many)).toHaveLength(MAX_ITEMS);
  });
});

describe('describeChanges (ham JSON gösterilmez)', () => {
  it('yalnızca değişen alanlar; hassas anahtarlar maskelenir; nesne özetlenir', () => {
    const rows = describeChanges(
      { ad: 'Eski', password_hash: 'abc', ayar: { a: 1 }, ayni: 1 },
      { ad: 'Yeni', password_hash: 'xyz', ayar: { a: 2 }, ayni: 1 },
    );
    expect(rows).toEqual([
      { field: 'ad', before: 'Eski', after: 'Yeni' },
      { field: 'password_hash', before: '••••', after: '••••' },
      { field: 'ayar', before: '(ayrıntılı nesne)', after: '(ayrıntılı nesne)' },
    ]);
  });
});

describe('useActivityStream', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    backfill.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const streamOf = (chunks: string[], keepOpen = false) => {
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(c) {
          for (const ch of chunks) c.enqueue(enc.encode(ch));
          if (!keepOpen) c.close();
        },
      }),
      { status: 200 },
    );
  };

  it('olayları parçalı gelse de alır; bağlantı kopunca yeniden bağlanır ve kaçanları son görülen zamandan tamamlar', async () => {
    const first = item('1', '2026-10-21T10:00:00.000Z');
    const missed = item('2', '2026-10-21T10:00:05.000Z');
    const live = item('3', '2026-10-21T10:00:09.000Z');
    const frame = sse(first);
    fetchMock
      .mockResolvedValueOnce(streamOf([frame.slice(0, 15), frame.slice(15)])) // parçalı + sonra kapanır
      .mockResolvedValueOnce(streamOf([sse(live)], true)); // yeniden bağlantı: açık kalır
    backfill.mockResolvedValueOnce([missed]);

    const { result } = renderHook(() => useActivityStream());
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['3', '2', '1']), { timeout: 5000 });
    expect(result.current.status).toBe('live');
    expect(backfill).toHaveBeenCalledWith('2026-10-21T10:00:00.000Z');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/logger\/admin\/activity-feed\/stream$/);
  });

  it('enabled=false iken hiç bağlanmaz', () => {
    renderHook(() => useActivityStream(false));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
