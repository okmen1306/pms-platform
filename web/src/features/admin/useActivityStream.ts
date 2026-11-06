import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, refreshAccessToken, tokenStore } from '../../shared/api';
import { fetchAuditSince, type ActivityItem } from './activity.api';

/**
 * Day 22 (madde 4): SSE yöntemi = `fetch` + `ReadableStream` (SEÇİLEN YÖNTEM, CHANGELOG'da).
 * Tarayıcının `EventSource`'u `Authorization` başlığı gönderemez; tek kullanımlık bilet yöntemi gateway'e
 * yeni bir uç ekler — gereksiz. Gerekçeler: JWT her zamanki başlıkla gider, 401'de aynı sessiz refresh çalışır.
 *
 * Yeniden bağlanma: üstel geri çekilme (1s → 30s). `Last-Event-ID` başlığı yine gönderilir ama logger-service
 * olaylara `id:` yazmıyor ve geçmişi tekrar oynatmıyor → bu yüzden bağlantı koptuktan sonra kaçan olaylar
 * `GET /logger/admin/audit-log?from=<son görülen createdAt>` ile TAMAMLANIR, `id`'ye göre tekilleştirilir.
 */
export type StreamStatus = 'connecting' | 'live' | 'reconnecting';

export const MAX_ITEMS = 200;

/** SSE metin akışını olaylara böler. Kalan (tamamlanmamış) kısmı `rest` olarak döner. */
export function parseSseChunk(buffer: string): { events: { id?: string; data: string }[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: { id?: string; data: string }[] = [];
  for (const block of parts) {
    let id: string | undefined;
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':') || line === '') continue; // yorum / keep-alive
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      else if (line.startsWith('id:')) id = line.slice(3).trim();
    }
    if (data.length > 0) events.push({ id, data: data.join('\n') });
  }
  return { events, rest };
}

/** Yeni olayları başa ekler, id'ye göre tekilleştirir, createdAt'e göre yeniden → eskiye sıralar, sınırlar. */
export function mergeActivity(current: ActivityItem[], incoming: ActivityItem[]): ActivityItem[] {
  const byId = new Map<string, ActivityItem>();
  for (const i of [...incoming, ...current]) if (!byId.has(i.id)) byId.set(i.id, i);
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)).slice(0, MAX_ITEMS);
}

export function parseActivityData(data: string): ActivityItem | null {
  try {
    const o = JSON.parse(data);
    if (typeof o?.id !== 'string' || typeof o?.createdAt !== 'string') return null;
    return {
      id: o.id,
      service: String(o.service ?? ''),
      eventType: String(o.eventType ?? ''),
      actorUserId: o.actorUserId ?? null,
      actorEmail: o.actorEmail ?? null,
      entityType: o.entityType ?? null,
      entityId: o.entityId ?? null,
      ozet: String(o.ozet ?? ''),
      severity: o.severity === 'critical' || o.severity === 'warning' ? o.severity : 'info',
      createdAt: o.createdAt,
    };
  } catch {
    return null;
  }
}

export function useActivityStream(enabled = true) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const lastSeen = useRef<string | null>(null);
  const lastEventId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const push = (incoming: ActivityItem[]) => {
      if (incoming.length === 0) return;
      for (const i of incoming) if (!lastSeen.current || i.createdAt > lastSeen.current) lastSeen.current = i.createdAt;
      setItems((cur) => mergeActivity(cur, incoming));
    };

    const connect = async (retried401 = false): Promise<void> => {
      controller = new AbortController();
      setStatus(attempt === 0 ? 'connecting' : 'reconnecting');
      try {
        const headers: Record<string, string> = { Accept: 'text/event-stream' };
        const token = tokenStore.get();
        if (token) headers.Authorization = `Bearer ${token}`;
        if (lastEventId.current) headers['Last-Event-ID'] = lastEventId.current;
        const res = await fetch(`${API_BASE_URL}/logger/admin/activity-feed/stream`, { headers, credentials: 'include', signal: controller.signal });
        if (res.status === 401 && !retried401 && (await refreshAccessToken())) return connect(true);
        if (!res.ok || !res.body) throw new Error(`HTTP_${res.status}`);

        // Kopukluk süresince kaçanları tamamla (ilk bağlantıda geçmiş yok → son görülen de yok).
        if (lastSeen.current) {
          try {
            push(await fetchAuditSince(lastSeen.current));
          } catch {
            /* tamamlama başarısızsa canlı akış yine de sürer */
          }
        }
        attempt = 0;
        setStatus('live');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSseChunk(buffer);
          buffer = rest;
          const parsed: ActivityItem[] = [];
          for (const e of events) {
            if (e.id) lastEventId.current = e.id;
            const item = parseActivityData(e.data);
            if (item) parsed.push(item);
          }
          push(parsed);
        }
      } catch {
        if (stopped) return;
      }
      if (stopped) return;
      // Sunucu kapattı ya da hata: geri çekilmeyle yeniden dene.
      setStatus('reconnecting');
      const delay = Math.min(30_000, 1000 * 2 ** attempt);
      attempt += 1;
      timer = setTimeout(() => void connect(), delay);
    };

    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  return { items, status };
}
