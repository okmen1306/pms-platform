#!/usr/bin/env node
/**
 * Day 5 (Q): "tüm servislerin ayakta olduğu doğrulama" — her servisin /health endpoint'ine
 * istek atar, hepsi "ok" dönene kadar (veya zaman aşımına uğrayana kadar) bekler. docker-compose
 * up sonrası veya CI'da (Day 18 entegrasyon haftasında) tek komutla sağlık kontrolü için kullanılır.
 */
const SERVICES = [
  { name: 'api-gateway', port: 3000 },
  { name: 'identity-service', port: 3001 },
  { name: 'personnel-service', port: 3002 },
  { name: 'project-service', port: 3003 },
  { name: 'procurement-service', port: 3004 },
  { name: 'integration-service', port: 3005 },
  { name: 'finance-service', port: 3006 },
  { name: 'performance-service', port: 3007 },
  { name: 'risk-service', port: 3008 },
  { name: 'notification-service', port: 3009 },
  { name: 'reporting-service', port: 3010 },
  { name: 'logger-service', port: 3011 },
];

const HOST = process.env.VERIFY_HOST ?? 'localhost';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

async function checkService(service) {
  const url = `http://${HOST}:${service.port}/health`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return { ...service, status: 'error', detail: `HTTP ${response.status}` };
    const body = await response.json();
    return { ...service, status: body.status === 'ok' ? 'ok' : 'degraded', detail: JSON.stringify(body) };
  } catch (err) {
    return { ...service, status: 'unreachable', detail: err.message };
  }
}

async function main() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const results = await Promise.all(SERVICES.map(checkService));
    const notOk = results.filter((r) => r.status !== 'ok');

    console.log(`\n[Deneme ${attempt}/${MAX_RETRIES}]`);
    results.forEach((r) => {
      const icon = r.status === 'ok' ? '✓' : '✗';
      console.log(`  ${icon} ${r.name.padEnd(22)} :${r.port}  ${r.status}`);
    });

    if (notOk.length === 0) {
      console.log('\nTüm servisler ayakta.');
      process.exit(0);
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    } else {
      console.error(`\n${notOk.length} servis ayağa kalkmadı: ${notOk.map((r) => r.name).join(', ')}`);
      process.exit(1);
    }
  }
}

main();
