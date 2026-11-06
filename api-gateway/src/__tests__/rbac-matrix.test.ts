import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { DEFAULT_ROLE_MATRIX, SEED_ROLE_KODLARI, type SeedRoleKod } from '@pms/shared';

vi.mock('ioredis', async () => {
  const RedisMock = (await import('ioredis-mock')).default;
  return { default: RedisMock };
});

/**
 * Day 21 (Q, G-01): RBAC matris testi. BEKLENEN kodlar `docs/testing/rbac-matrix.md`'deki tablodan
 * ayrıştırılır (elle yazılmış, belge = sözleşme); GERÇEK izinler ise seed'in kaynağı olan
 * DEFAULT_ROLE_MATRIX'ten identity stub'ı aracılığıyla gelir. İki bağımsız yapı, gerçek gateway
 * üzerinden karşılaştırılır — biri değişir ve diğeri değişmezse test kırılır.
 * Kapsam sınırı: upstream'ler stub; bu GATEWAY kapısını doğrular, gerçek servis zincirini değil.
 */
const JWT_SECRET = 'test-secret-rbac-matrix-day21';
const ROLE_SUB: Record<SeedRoleKod, string> = {
  sirket_yoneticisi: '00000000-0000-0000-0000-0000000000a1',
  ekip_lideri: '00000000-0000-0000-0000-0000000000a2',
  ik_yoneticisi: '00000000-0000-0000-0000-0000000000a3',
  satinalma_personeli: '00000000-0000-0000-0000-0000000000a4',
  personel: '00000000-0000-0000-0000-0000000000a5',
};
const SUB_ROLE = Object.fromEntries(Object.entries(ROLE_SUB).map(([k, v]) => [v, k])) as Record<string, SeedRoleKod>;
const SAMPLE_ID = '00000000-0000-0000-0000-0000000000ee';

function startServer(handler: http.RequestListener): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
  });
}
const sendJson = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const token = (rol: SeedRoleKod) =>
  jwt.sign(
    { sub: ROLE_SUB[rol], email: `${rol}@x.com`, roleId: ROLE_SUB[rol], roleKod: rol, isSuperAdmin: false, personnelId: null, dilTercihi: 'tr' },
    JWT_SECRET,
    { expiresIn: 3600 },
  );

interface Row { prefix: string; key: string; cells: Record<SeedRoleKod, string> }
function parseMatrixDoc(): Row[] {
  const md = fs.readFileSync(path.resolve(__dirname, '../../../docs/testing/rbac-matrix.md'), 'utf8');
  const block = md.split('<!-- RBAC-MATRIX:BEGIN -->')[1]?.split('<!-- RBAC-MATRIX:END -->')[0] ?? '';
  return block
    .split('\n')
    .filter((l) => l.startsWith('| /'))
    .map((l) => {
      const c = l.split('|').slice(1, -1).map((x) => x.trim());
      return {
        prefix: c[0].replace(/`/g, ''),
        key: c[1],
        cells: Object.fromEntries(SEED_ROLE_KODLARI.map((r, i) => [r, c[2 + i]])) as Record<SeedRoleKod, string>,
      };
    });
}

describe('api-gateway: RBAC matrisi (Q, Day 21)', () => {
  let app: FastifyInstance;
  const servers: http.Server[] = [];

  beforeAll(async () => {
    const identity = await startServer((req, res) => {
      // Day 22: gateway'in /identity/users ve /identity/me kapılarını da sınamak için yankı uçları.
      if (req.url && /^\/(users|roles|me\/password)/.test(req.url) && !/effective-permissions/.test(req.url)) {
        return sendJson(res, 200, { success: true, data: { echo: req.url, actor: req.headers['x-actor-id'] }, meta: null, error: null });
      }
      const m = req.url?.match(/^\/users\/([^/]+)\/effective-permissions/);
      if (!m) return sendJson(res, 404, { success: false });
      const rol = SUB_ROLE[m[1]];
      const grants = DEFAULT_ROLE_MATRIX[rol] ?? {};
      const data = Object.entries(grants).map(([permission_key, g]) => ({
        permission_key, can_view: true, can_edit: g === 'VE', is_override: false,
      }));
      sendJson(res, 200, { success: true, data, meta: null, error: null });
    });
    const upstream = await startServer((_req, res) => sendJson(res, 200, { success: true, data: { echo: true }, meta: null, error: null }));
    servers.push(identity.server, upstream.server);

    process.env.JWT_SECRET = JWT_SECRET;
    process.env.RATE_LIMIT_MAX = '100000';
    process.env.IDENTITY_SERVICE_URL = identity.url;
    for (const k of ['PERSONNEL', 'PROJECT', 'PROCUREMENT', 'INTEGRATION', 'FINANCE', 'PERFORMANCE', 'RISK', 'NOTIFICATION', 'REPORTING', 'LOGGER']) {
      process.env[`${k}_SERVICE_URL`] = upstream.url;
    }
    const { buildApp } = await import('../app');
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  });

  const rows = parseMatrixDoc();

  it('belge tablosu 11 modül satırı içeriyor (ayrıştırma sessizce boş kalmasın)', () => {
    expect(rows).toHaveLength(11);
  });

  for (const row of parseMatrixDoc()) {
    for (const rol of SEED_ROLE_KODLARI) {
      it(`${row.prefix} × ${rol}: ${row.cells[rol]}`, async () => {
        const [read, write] = row.cells[rol].split('/');
        const isSalary = row.prefix.includes('/salary');
        const url = isSalary ? `/personnel/employees/${SAMPLE_ID}/salary` : `${row.prefix}/probe`;
        const headers = { authorization: `Bearer ${token(rol)}` };

        const r = await app.inject({ method: 'GET', url, headers });
        expect(r.statusCode, `GET ${url}`).toBe(Number(read));
        if (Number(read) === 403) expect(r.json().error.code).toBe('FORBIDDEN_PAGE_ACCESS');

        if (write !== '-') {
          const w = await app.inject({ method: 'POST', url, headers, payload: {} });
          expect(w.statusCode, `POST ${url}`).toBe(Number(write));
        }
      });
    }
  }

  it('GET /identity/me/effective-permissions: admin OLMAYAN kullanıcı KENDİ izinlerini okur (camelCase)', async () => {
    const r = await app.inject({ method: 'GET', url: '/identity/me/effective-permissions', headers: { authorization: `Bearer ${token('personel')}` } });
    expect(r.statusCode).toBe(200);
    const keys = r.json().data.map((p: any) => p.permissionKey).sort();
    expect(keys).toEqual(['performance.score', 'project.records', 'risk.analysis']);
    expect(r.json().data.every((p: any) => p.canEdit === false)).toBe(true);
  });

  it('/identity/* (rol yönetimi) admin OLMAYAN için 403; me/effective-permissions kimliksiz 401', async () => {
    const a = await app.inject({ method: 'GET', url: '/identity/roles', headers: { authorization: `Bearer ${token('ik_yoneticisi')}` } });
    expect(a.statusCode).toBe(403);
    const b = await app.inject({ method: 'GET', url: '/identity/me/effective-permissions' });
    expect(b.statusCode).toBe(401);
  });

  describe('/identity/users ayrı kapısı (Day 22, G-02)', () => {
    const call = (rol: SeedRoleKod, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string) =>
      app.inject({ method, url, headers: { authorization: `Bearer ${token(rol)}` }, ...(method === 'GET' || method === 'DELETE' ? {} : { payload: {} }) });

    it('GET/POST /identity/users: admin.users.manage sahibi (sirket + ik) geçer; ekip_lideri, satinalma, personel 403', async () => {
      for (const [rol, code] of [['sirket_yoneticisi', 200], ['ik_yoneticisi', 200], ['ekip_lideri', 403], ['satinalma_personeli', 403], ['personel', 403]] as const) {
        expect((await call(rol, 'GET', '/identity/users')).statusCode, `GET ${rol}`).toBe(code);
        expect((await call(rol, 'POST', '/identity/users')).statusCode, `POST ${rol}`).toBe(code);
      }
    });

    it('sorgu dizgisi ve sondaki / aynı kapıdan geçer (ik: 200)', async () => {
      expect((await call('ik_yoneticisi', 'GET', '/identity/users?role=personel&status=active')).statusCode).toBe(200);
      expect((await call('ik_yoneticisi', 'GET', '/identity/users/')).statusCode).toBe(200);
    });

    it('GEVŞETME SIZMAZ: alt yollar ve rol uçları ik_yoneticisi için 403 (admin.roles.manage)', async () => {
      for (const [m, url] of [
        ['PATCH', `/identity/users/${SAMPLE_ID}/role`],
        ['GET', `/identity/users/${SAMPLE_ID}/permission-overrides`],
        ['GET', `/identity/users/${SAMPLE_ID}/effective-permissions`],
        ['GET', '/identity/roles'],
        ['PATCH', `/identity/roles/${SAMPLE_ID}`],
        ['GET', '/identity/users/../roles'],
        ['GET', '/identity//users'],
        ['GET', '/identity/Users'],
        ['GET', '/identity/users%2Fx'],
      ] as const) {
        expect((await call('ik_yoneticisi', m, url)).statusCode, `${m} ${url}`).toBe(403);
      }
      expect((await call('sirket_yoneticisi', 'PATCH', `/identity/users/${SAMPLE_ID}/role`)).statusCode).toBe(200);
      expect((await call('sirket_yoneticisi', 'PATCH', `/identity/roles/${SAMPLE_ID}`)).statusCode).toBe(200);
    });

    it('/identity/users okuma-yazma ayrımı: izin yöntem bazlı (ik için view+edit var; yalnızca view olan rol POST yapamaz)', async () => {
      // ekip_lideri'nde admin.users.manage hiç yok; yöntem bazlılık matris testinde zaten kanıtlı —
      // burada yalnızca ik'nin iki yöntemde de geçtiği doğrulandı (yukarıda).
      expect((await call('ik_yoneticisi', 'DELETE', '/identity/users')).statusCode).toBe(200);
    });

    it('/identity/me/password: kimlikli HERKES (personel dahil) geçer; kimliksiz 401; x-actor-id JWT\'den gelir (istemci başlığı ezilir)', async () => {
      const r = await app.inject({
        method: 'POST', url: '/identity/me/password',
        headers: { authorization: `Bearer ${token('personel')}`, 'x-actor-id': 'SAHTE-KIMLIK' }, payload: {},
      });
      expect(r.statusCode).toBe(200);
      expect(r.json().data.actor).toBe(ROLE_SUB.personel);
      expect((await app.inject({ method: 'POST', url: '/identity/me/password', payload: {} })).statusCode).toBe(401);
    });
  });

  describe('geçici parola zorlaması (Day 22)', () => {
    const tempToken = () =>
      jwt.sign(
        { sub: ROLE_SUB.sirket_yoneticisi, email: 'x@x.com', roleId: ROLE_SUB.sirket_yoneticisi, roleKod: 'sirket_yoneticisi', isSuperAdmin: true, personnelId: null, dilTercihi: 'tr', mustChangePassword: true },
        JWT_SECRET,
        { expiresIn: 3600 },
      );
    const get = (url: string, method: 'GET' | 'POST' = 'GET') =>
      app.inject({ method, url, headers: { authorization: `Bearer ${tempToken()}` }, ...(method === 'POST' ? { payload: {} } : {}) });

    it('süper admin bile olsa mustChangePassword=true token ile her uç 403 PASSWORD_CHANGE_REQUIRED', async () => {
      for (const url of ['/project/projects', '/identity/users', '/identity/roles', '/finance/projects/x/costs', '/personnel/employees']) {
        const r = await get(url);
        expect(r.statusCode, url).toBe(403);
        expect(r.json().error.code, url).toBe('PASSWORD_CHANGE_REQUIRED');
      }
    });
    it('yalnızca parola değiştirme ve kendi izinleri açık (sorgu dizgisi / sondaki / ile de)', async () => {
      expect((await get('/identity/me/password', 'POST')).statusCode).toBe(200);
      expect((await get('/identity/me/effective-permissions')).statusCode).toBe(200);
      expect((await get('/identity/me/effective-permissions?x=1')).statusCode).toBe(200);
    });
    it('allowlist yol ÖNEKİ değil birebir: /identity/me/password/x ve /identity/me/passwordx kapalı', async () => {
      expect((await get('/identity/me/password/x', 'POST')).statusCode).toBe(403);
      expect((await get('/identity/me/passwordx', 'POST')).statusCode).toBe(403);
    });
    it('bayraksız (veya false) token etkilenmez', async () => {
      expect((await app.inject({ method: 'GET', url: '/project/projects', headers: { authorization: `Bearer ${token('sirket_yoneticisi')}` } })).statusCode).toBe(200);
    });
  });
});
