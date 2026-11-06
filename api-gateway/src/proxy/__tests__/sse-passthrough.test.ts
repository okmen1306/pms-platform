import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerServiceProxy } from '../service-proxy';

/**
 * Day 22 (madde 4): aktivite akışı gateway'den GEÇMEK zorunda (`/logger/*`). Gerçek bir sahte SSE upstream'i
 * (logger-service'in `reply.raw.writeHead` + `:ok` + `data:` davranışının aynısı) bağlantıyı AÇIK tutarken
 * istemci ilk olayı almalı — yani proxy yanıtı tamponlamıyor — ve CORS başlıkları gateway'den gelmeli.
 */
describe('gateway SSE geçişi', () => {
  let upstream: http.Server;
  let app: FastifyInstance;
  const closers: Array<() => void> = [];
  afterEach(async () => {
    closers.splice(0).forEach((c) => c());
    await app?.close();
    await new Promise((r) => upstream?.close(r));
  });

  it('upstream açık kalırken ilk olay istemciye akar; CORS + text/event-stream korunur', async () => {
    upstream = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(':ok\n\n');
      res.write('data: {"id":"1","createdAt":"2026-10-21T10:00:00Z"}\n\n');
      closers.push(() => res.end()); // test bitene kadar KAPATMA
      req.on('close', () => res.end());
    });
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r));
    const upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

    app = Fastify();
    await app.register(cors, { origin: ['http://localhost:5173'], credentials: true });
    await registerServiceProxy(app, { prefix: '/logger', upstream: upstreamUrl, preHandler: [] });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;

    const ac = new AbortController();
    const res = await fetch(`${base}/logger/admin/activity-feed/stream`, { headers: { Origin: 'http://localhost:5173' }, signal: ac.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    const reader = res.body!.getReader();
    let text = '';
    const deadline = Date.now() + 3000;
    while (!text.includes('"id":"1"') && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    expect(text).toContain('data: {"id":"1"');
    ac.abort();
  });
});
