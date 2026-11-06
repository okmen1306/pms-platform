import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { summarize, compareRateLimiting, runBasicScenario, THRESHOLDS } from '../basic-scenario.mjs';

/** autocannon'ın gerçek sonuç şeklinin (bkz. basic-scenario.mjs üstündeki keşif notu) minik bir taklidi. */
function fakeAutocannonResult({ sent = 100, errors = 0, timeouts = 0, non2xx = 0, p97_5 = 10, status429 = 0 }) {
  return {
    requests: { sent },
    errors,
    timeouts,
    non2xx,
    latency: { p97_5 },
    statusCodeStats: status429 > 0 ? { '429': { count: status429 } } : {},
  };
}

async function startStubServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://localhost:${port}` };
}

describe('summarize (Q, Day 13 — eşik hesaplama mantığı)', () => {
  test('hata oranı ve p97.5 gecikme EŞİK İÇİNDEYSE passed=true', () => {
    const s = summarize('test', fakeAutocannonResult({ sent: 1000, errors: 0, p97_5: 50 }));
    assert.equal(s.passed, true);
    assert.equal(s.errorRatePercent, 0);
  });

  test('p97.5 gecikme eşiği AŞARSA passed=false', () => {
    const s = summarize('test', fakeAutocannonResult({ sent: 1000, p97_5: THRESHOLDS.p97_5LatencyMs + 1 }));
    assert.equal(s.passed, false);
  });

  test('hata oranı eşiği AŞARSA passed=false', () => {
    const s = summarize('test', fakeAutocannonResult({ sent: 100, errors: 5, p97_5: 10 }));
    assert.equal(s.errorRatePercent, 5);
    assert.equal(s.passed, false);
  });

  test('statusCodeStats[429] varsa status429Count DOĞRU okunur', () => {
    const s = summarize('test', fakeAutocannonResult({ status429: 12 }));
    assert.equal(s.status429Count, 12);
  });
});

describe('compareRateLimiting (Q, Day 13 — /auth/login özel limit bulgusu)', () => {
  test('HİÇBİR faz 429 almadıysa inconclusive=true döner (limit eşiğine ulaşılmadı)', () => {
    const result = compareRateLimiting(
      summarize('health', fakeAutocannonResult({ status429: 0 })),
      summarize('login', fakeAutocannonResult({ status429: 0 })),
    );
    assert.equal(result.inconclusive, true);
    assert.equal(result.loginHasStricterLimit, null);
  });

  test('SADECE login 429 alıyorsa loginHasStricterLimit=true (checklist maddesi KARŞILANMIŞ)', () => {
    const result = compareRateLimiting(
      summarize('health', fakeAutocannonResult({ status429: 0 })),
      summarize('login', fakeAutocannonResult({ status429: 8 })),
    );
    assert.equal(result.inconclusive, false);
    assert.equal(result.loginHasStricterLimit, true);
  });

  test('HER İKİSİ de 429 alıyorsa (mevcut gateway davranışı — genel IP limiti) loginHasStricterLimit=false', () => {
    const result = compareRateLimiting(
      summarize('health', fakeAutocannonResult({ status429: 5 })),
      summarize('login', fakeAutocannonResult({ status429: 5 })),
    );
    assert.equal(result.inconclusive, false);
    assert.equal(result.loginHasStricterLimit, false);
  });
});

describe('runBasicScenario (Q, Day 13 — uçtan uca harness, YEREL stub sunucuya karşı)', () => {
  test('iki fazı da çalıştırır ve yapısı doğru bir rapor döner (gerçek backend YOK — sadece stub)', async () => {
    const { server, baseUrl } = await startStubServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });

    try {
      const report = await runBasicScenario({ baseUrl, durationSeconds: 1, connections: 5 });
      assert.ok(report.healthSummary.totalRequests > 0);
      assert.ok(report.loginSummary.totalRequests > 0);
      assert.equal(report.rateLimitFinding.inconclusive, true); // stub hiç 429 döndürmüyor
    } finally {
      server.close();
    }
  });

  test('stub sunucu SADECE /identity/auth/login\'i 429\'a düşürürse harness bunu YAKALAR', async () => {
    let loginRequestCount = 0;
    const { server, baseUrl } = await startStubServer((req, res) => {
      if (req.url?.startsWith('/identity/auth/login')) {
        loginRequestCount += 1;
        if (loginRequestCount > 3) {
          res.writeHead(429, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ error: 'too_many_requests' }));
        }
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });

    try {
      const report = await runBasicScenario({ baseUrl, durationSeconds: 1, connections: 5 });
      assert.equal(report.healthSummary.status429Count, 0);
      assert.ok(report.loginSummary.status429Count > 0);
      assert.equal(report.rateLimitFinding.loginHasStricterLimit, true);
    } finally {
      server.close();
    }
  });
});
