import autocannon from 'autocannon';

/**
 * Q (Day 13, "yük testi — temel senaryo"): docs/roadmap.md Bölüm 14.2'nin KENDİ ayrımı —
 * bugün SADECE "temel senaryo" (Day 26'da "ikinci yük testi", sorgu optimizasyonuyla BİRLİKTE,
 * bkz. roadmap.md satır 1970). audit-baseline.md'deki (Day 12) AYNI disiplin: bugün gerçek bir
 * canlı kümeye (Redis + RabbitMQ + Supabase) karşı ÇALIŞTIRILAMADI (bu kum havuzunda hiçbiri
 * yok) — bu yüzden harness'ın KENDİSİ (bu dosya + summarize/compareRateLimiting) gerçek ve
 * eksiksiz yazıldı, ama SONUÇLAR henüz üretilmedi. `basic-scenario.selftest.mjs` harness'ın
 * mantığını YEREL bir stub sunucuya karşı doğrular (Day 8'in Playwright duman testiyle AYNI
 * "backend'e dokunmadan yapının çalıştığını kanıtlama" deseni) — CI'da GERÇEKTEN çalışır.
 *
 * Güvenlik Kontrol Listesi (roadmap.md Bölüm 12, satır 1824) HÂLÂ işaretsiz:
 * "Rate limiting: `/auth/login` özelinde daha sıkı (brute-force önleme)." api-gateway'in
 * `rate-limit.middleware.ts`'i (Day 3) TEK bir genel IP-bazlı limit uygular (100 istek/60s,
 * bkz. service.config.ts) — `/auth/login` için AYRI/daha sıkı bir limit YOK. Bu senaryonun
 * 2. fazı bunu KANITLAMAK için tasarlandı: `/health` ile `/identity/auth/login`'in 429 eşiği
 * AYNI çıkarsa (statusCodeStats['429']), bu bulgu doğrulanmış olur.
 */
export const THRESHOLDS = {
  p97_5LatencyMs: 300,
  errorRatePercent: 1,
};

export function summarize(label, result) {
  const totalRequests = result.requests.sent;
  const failed = result.errors + result.timeouts + result.non2xx;
  const errorRatePercent = totalRequests === 0 ? 0 : Math.round((failed / totalRequests) * 10000) / 100;
  const status429Count = result.statusCodeStats?.['429']?.count ?? 0;

  return {
    label,
    totalRequests,
    errorRatePercent,
    p97_5LatencyMs: result.latency.p97_5,
    status429Count,
    passed: result.latency.p97_5 <= THRESHOLDS.p97_5LatencyMs && errorRatePercent <= THRESHOLDS.errorRatePercent,
  };
}

/**
 * İki fazın 429 davranışını karşılaştırır — `/auth/login` GENEL limitten FARKLI (daha sıkı)
 * davranıyorsa `loginHasStricterLimit: true` döner. Her iki faz de HİÇ 429 almadıysa (örn.
 * kısa süreli/az bağlantılı bir çalıştırma limite hiç ulaşmadıysa) `inconclusive: true` ile
 * işaretlenir — sonuç YOKMUŞ gibi YORUMLANMAZ.
 */
export function compareRateLimiting(healthSummary, loginSummary) {
  if (healthSummary.status429Count === 0 && loginSummary.status429Count === 0) {
    return { inconclusive: true, loginHasStricterLimit: null };
  }
  // Genel limit her iki rotada da AYNI eşikte devreye giriyorsa (health de 429 alıyorsa
  // login'le kıyaslanabilir oranda), login'in AYRI/daha sıkı bir limiti YOK demektir.
  const loginHasStricterLimit = loginSummary.status429Count > 0 && healthSummary.status429Count === 0;
  return { inconclusive: false, loginHasStricterLimit };
}

export async function runBasicScenario({
  baseUrl = process.env.LOADTEST_BASE_URL ?? 'http://localhost:3000',
  durationSeconds = Number(process.env.LOADTEST_DURATION_SECONDS ?? 10),
  connections = Number(process.env.LOADTEST_CONNECTIONS ?? 20),
} = {}) {
  const healthResult = await autocannon({ url: `${baseUrl}/health`, connections, duration: durationSeconds });
  const healthSummary = summarize('GET /health (genel yük)', healthResult);

  const loginResult = await autocannon({
    url: `${baseUrl}/identity/auth/login`,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'yuk-testi@acme.test', password: 'yanlis-sifre' }),
    connections,
    duration: durationSeconds,
  });
  const loginSummary = summarize('POST /identity/auth/login (brute-force senaryosu)', loginResult);

  const rateLimitFinding = compareRateLimiting(healthSummary, loginSummary);

  return { healthSummary, loginSummary, rateLimitFinding };
}

function printReport({ healthSummary, loginSummary, rateLimitFinding }) {
  for (const s of [healthSummary, loginSummary]) {
    console.log(`\n${s.label}`);
    console.log(`  toplam istek: ${s.totalRequests}, hata oranı: %${s.errorRatePercent}, p97.5 gecikme: ${s.p97_5LatencyMs}ms, 429 sayısı: ${s.status429Count}`);
    console.log(`  eşik kontrolü: ${s.passed ? 'GEÇTİ' : 'BAŞARISIZ'} (p97.5 <= ${THRESHOLDS.p97_5LatencyMs}ms, hata oranı <= %${THRESHOLDS.errorRatePercent})`);
  }

  console.log('\nGüvenlik Kontrol Listesi bulgusu (/auth/login özel rate limiti — roadmap.md satır 1824):');
  if (rateLimitFinding.inconclusive) {
    console.log('  SONUÇSUZ — bu çalıştırmada hiçbir rota 429 almadı (limit eşiğine ulaşılmadı, süre/bağlantı sayısını artırıp tekrar deneyin).');
  } else if (rateLimitFinding.loginHasStricterLimit) {
    console.log('  /auth/login GENEL limitten DAHA SIKI davranıyor — checklist maddesi karşılanmış görünüyor.');
  } else {
    console.log('  /auth/login GENEL limitle (100 istek/60s, IP bazlı) AYNI davranıyor — checklist maddesi HÂLÂ karşılanmadı.');
  }
}

// Doğrudan çalıştırıldığında (npm run scenario) gerçek bir hedefe karşı koşar ve raporu yazdırır.
if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runBasicScenario();
  printReport(report);
  const allPassed = report.healthSummary.passed && report.loginSummary.passed;
  process.exit(allPassed ? 0 : 1);
}
