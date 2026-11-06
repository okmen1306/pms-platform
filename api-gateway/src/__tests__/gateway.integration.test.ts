import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis'; // vi.mock('ioredis', ...) aşağıda tanımlı — bu, ioredis-mock'a çözümlenir
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';

/**
 * TL (Day 8): "api-gateway entegrasyon testleri". `@fastify/rate-limit`'in Redis store'u
 * gerçek bir Redis sunucusu olmadan test edilemez (CI'da Redis container'ı YOK, bkz.
 * .github/workflows/ci.yml) — bu yüzden `ioredis` modülü, Lua `EVAL`/`defineCommand`'ı
 * TAM destekleyen `ioredis-mock` ile değiştirilir (doğrulandı: RedisStore.js'in kullandığı
 * `redis.defineCommand('rateLimit', {...})` çağrısı ioredis-mock'ta sorunsuz çalışıyor).
 */
vi.mock('ioredis', async () => {
  const RedisMock = (await import('ioredis-mock')).default;
  return { default: RedisMock };
});

const JWT_SECRET = 'test-secret-gateway-day8';

function startMockServer(handler: http.RequestListener): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function signToken(overrides: { sub?: string; roleKod?: string; isSuperAdmin?: boolean; expiresInSeconds?: number } = {}): string {
  const { expiresInSeconds = 3600, ...payload } = overrides;
  return jwt.sign(
    {
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'test@example.com',
      roleId: '00000000-0000-0000-0000-0000000000aa',
      roleKod: 'personel',
      isSuperAdmin: false,
      personnelId: null,
      dilTercihi: 'tr',
      ...payload,
    },
    JWT_SECRET,
    { expiresIn: expiresInSeconds },
  );
}

describe('api-gateway: auth + RBAC + proxy (TL, Day 8)', () => {
  let app: FastifyInstance;
  let identityServer: http.Server;
  let downstreamServer: http.Server;
  const downstreamRequests: { url?: string; headers: http.IncomingHttpHeaders }[] = [];
  let effectivePermissions: Array<{ permission_key: string; can_view: boolean; can_edit: boolean; is_override: boolean }> = [];

  beforeAll(async () => {
    const identity = await startMockServer((req, res) => {
      // Day 18 (entegrasyon bulgusu, bkz. CHANGELOG.md): prefix: '/identity/auth' ARTIK
      // rewritePrefix: '/auth' ile kayıtlı -> /identity/auth/login proxy'lendiğinde upstream'e
      // '/auth/login' ulaşır (identity-service'in GERÇEK rotası buydu; eski '' davranışı
      // upstream'e sadece '/login' gönderiyordu ve bu test o HATAYI doğru diye kontrol ediyordu —
      // mock login hiçbir zaman gerçek isteği denemediği için Day 18'e kadar fark edilmemişti).
      if (req.url === '/auth/login') {
        return sendJson(res, 200, { success: true, data: { accessToken: 'sahte-token' }, meta: null, error: null });
      }
      if (req.url?.includes('/effective-permissions')) {
        return sendJson(res, 200, { success: true, data: effectivePermissions, meta: null, error: null });
      }
      sendJson(res, 404, { success: false, data: null, meta: null, error: { code: 'NOT_FOUND', message: 'bulunamadı' } });
    });
    identityServer = identity.server;

    const downstream = await startMockServer((req, res) => {
      downstreamRequests.push({ url: req.url, headers: req.headers });
      sendJson(res, 200, { success: true, data: { echo: true }, meta: null, error: null });
    });
    downstreamServer = downstream.server;

    process.env.JWT_SECRET = JWT_SECRET;
    process.env.IDENTITY_SERVICE_URL = identity.url;
    process.env.PROJECT_SERVICE_URL = downstream.url;
    process.env.FINANCE_SERVICE_URL = downstream.url;
    // Bu describe bloğu rate limiti KASITLI OLARAK test etmiyor (o ayrı bloğun konusu) —
    // varsayılan (100/dk) burada tükenmeyecek kadar yüksek, ~10 isteklik bu paket için güvenli.

    const { buildApp } = await import('../app');
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => identityServer.close(resolve));
    await new Promise((resolve) => downstreamServer.close(resolve));
  });

  it('/identity/auth/* TOKEN OLMADAN proxy\'lenir (login\'in kendisi JWT üretir, "tavuk-yumurta" problemi)', async () => {
    const res = await app.inject({ method: 'POST', url: '/identity/auth/login', payload: { email: 'a@b.com', sifre: 'x' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.accessToken).toBe('sahte-token');
  });

  it('korumalı /project/* rotası, Authorization header OLMADAN 401 UNAUTHORIZED döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/project/projects' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('geçersiz Bearer formatı (Bearer önekisiz) 401 döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/project/projects', headers: { authorization: 'sadece-token' } });
    expect(res.statusCode).toBe(401);
  });

  it('süresi dolmuş JWT 401 döner', async () => {
    const expired = signToken({ expiresInSeconds: -10 });
    const res = await app.inject({ method: 'GET', url: '/project/projects', headers: { authorization: `Bearer ${expired}` } });
    expect(res.statusCode).toBe(401);
  });

  it('geçerli JWT ile /project/* upstream\'e proxy\'lenir VE x-actor-id/x-actor-role header\'ları eklenir', async () => {
    const actorId = '00000000-0000-0000-0000-000000000042';
    const token = signToken({ sub: actorId, roleKod: 'proje_yoneticisi' });
    // Day 21 (G-01): /project/* artık yalnızca authenticate değil, project.records izni de ister.
    effectivePermissions = [{ permission_key: 'project.records', can_view: true, can_edit: false, is_override: false }];
    const res = await app.inject({ method: 'GET', url: '/project/projects', headers: { authorization: `Bearer ${token}` } });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.echo).toBe(true);

    const forwarded = downstreamRequests.at(-1)!;
    expect(forwarded.url).toBe('/projects'); // prefix stripped (rewritePrefix: '')
    expect(forwarded.headers['x-actor-id']).toBe(actorId);
    expect(forwarded.headers['x-actor-role']).toBe('proje_yoneticisi');
  });

  it('finance.cost_analysis izni OLMAYAN kullanıcı için /finance/* 403 FORBIDDEN_PAGE_ACCESS döner', async () => {
    effectivePermissions = [];
    const token = signToken({ sub: '00000000-0000-0000-0000-000000000002', roleKod: 'personel' });
    const res = await app.inject({ method: 'GET', url: '/finance/cost-analysis', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN_PAGE_ACCESS');
  });

  it('finance.cost_analysis "view" izni OLAN kullanıcı için /finance/* proxy\'lenir', async () => {
    effectivePermissions = [{ permission_key: 'finance.cost_analysis', can_view: true, can_edit: false, is_override: false }];
    const token = signToken({ sub: '00000000-0000-0000-0000-000000000003', roleKod: 'sirket_yoneticisi' });
    const res = await app.inject({ method: 'GET', url: '/finance/cost-analysis', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
  });

  it('isSuperAdmin:true, identity-service\'e izin SORMADAN her yere erişir (rbac.middleware.ts kısa devresi)', async () => {
    effectivePermissions = []; // bilinçli: izin YOK ama super admin geçmeli
    const token = signToken({ sub: '00000000-0000-0000-0000-000000000004', roleKod: 'sirket_yoneticisi', isSuperAdmin: true });
    const res = await app.inject({ method: 'GET', url: '/finance/cost-analysis', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
  });

  it('CORS ön-uçuşu (preflight): PATCH ve DELETE izinli (Day 19 entegrasyon bulgusu — varsayılan sadece GET,HEAD,POST idi)', async () => {
    for (const method of ['PATCH', 'DELETE']) {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/project/assignments/00000000-0000-0000-0000-000000000001/complete',
        headers: { origin: 'http://localhost:5173', 'access-control-request-method': method },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(String(res.headers['access-control-allow-methods'])).toContain(method);
    }
  });

  it('CORS: izin listesinde OLMAYAN origin ön-uçuşta allow-origin başlığı ALMAZ', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/project/projects',
      headers: { origin: 'http://kotu-site.example', 'access-control-request-method': 'POST' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('/health, authenticate GEREKTİRMEDEN 200 döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});

describe('api-gateway: rate limiting (TL, Day 8)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.RATE_LIMIT_MAX = '3';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';

    // ÖLÇÜLDÜ (deneyle doğrulandı): ioredis-mock, farklı connection string'lere/db index'lerine
    // rağmen TEK bir process-genelinde paylaşılan bellek içi store kullanıyor (gerçek Redis'in
    // `SELECT db` izolasyonunu TAKLİT ETMİYOR) — yani yukarıdaki describe bloğunun 9 isteği
    // AYNI sayaca eklenmiş durumda. `REDIS_URL`'i değiştirmek YETMEZ; sayaç açıkça temizlenmeli.
    await new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/15').flushall();

    // service.config.ts modül YÜKLENİRKEN process.env'i okuyor (fonksiyon değil, sabit obje) —
    // önceki describe'da ZATEN import edilip önbelleğe alınmış olabileceğinden, YENİ env
    // değerleriyle yeniden değerlendirilmesi için modül önbelleği temizlenir.
    vi.resetModules();
    const { buildApp } = await import('../app');
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('limit aşılınca 429 RATE_LIMIT_EXCEEDED döner (limit=3/dk, auth gerektirmeyen /health ile test edilir)', async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await app.inject({ method: 'GET', url: '/health' }));
    }
    expect(results[0].statusCode).toBe(200);
    expect(results[1].statusCode).toBe(200);
    expect(results[2].statusCode).toBe(200);
    expect(results[3].statusCode).toBe(429);
    expect(results[3].json().error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(results[4].statusCode).toBe(429);
  });
});
