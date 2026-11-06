/**
 * Day 18: yerel "Supabase" katmanının son parçası. `@supabase/supabase-js`, tablolara
 * `${SUPABASE_URL}/rest/v1/<tablo>` üzerinden erişir; gerçek Supabase'te Kong bu öneki PostgREST'e
 * yönlendirir. Bu küçük shim aynı işi yapar: `/rest/v1` önekini soyup PostgREST'e (varsayılan
 * 3100) olduğu gibi iletir. Sonuç: servisler, gerçek Postgres'e karşı GERÇEK PostgREST ile
 * konuşur — Supabase istemcisinin kullandığı sorgu sözdizimi (filtreler, `select`, `Prefer`
 * başlıkları) birebir aynı motor tarafından çözülür.
 *
 * Kullanım: node supabase-shim.mjs   (SHIM_PORT=54321, POSTGREST_URL=http://127.0.0.1:3100)
 */
import http from 'node:http';

const SHIM_PORT = Number(process.env.SHIM_PORT ?? 54321);
const target = new URL(process.env.POSTGREST_URL ?? 'http://127.0.0.1:3100');

http
  .createServer((req, res) => {
    if (!req.url?.startsWith('/rest/v1')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'yerel shim sadece /rest/v1 destekler' }));
      return;
    }
    const upstream = http.request(
      { host: target.hostname, port: target.port, method: req.method, path: req.url.slice('/rest/v1'.length) || '/', headers: { ...req.headers, host: target.host } },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: `PostgREST'e ulaşılamadı: ${err.message}` }));
    });
    req.pipe(upstream);
  })
  .listen(SHIM_PORT, () => console.log(`supabase-shim :${SHIM_PORT} -> ${target.origin}`));
