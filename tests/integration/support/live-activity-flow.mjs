/**
 * Day 22 (devam 2): gerçek gateway + logger-service + RabbitMQ audit zinciri üzerinde
 *  (1) KABUL KRİTERİ: yapılan işlem aktivite akışında (SSE, gateway üzerinden) görünür,
 *  (2) GET /logger/admin/system-pulse, (3) denetim detayı (ham/hassas veri sızmaz),
 *  (4) yetki kapıları (akış/pulse yalnızca admin.audit_log; G-26 teyidi),
 *  (5) kopma sonrası tamamlama sözleşmesi (audit-log?from=...).
 * Ortam: GATEWAY, ADMIN_EMAIL, ADMIN_PASSWORD. Çalıştırıcı: run-admin-verification.sh (Faz 3).
 */
const GW = process.env.GATEWAY ?? 'http://127.0.0.1:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

let pass = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) pass++;
  else {
    failures.push(`${name} ${detail}`);
    console.log(`  ✗ ${name} ${detail}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, url, { token, body } = {}) {
  const res = await fetch(`${GW}${url}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* JSON değil */ }
  return { status: res.status, json, text };
}
const login = async (email, password) => {
  const r = await call('POST', '/identity/auth/login', { body: { email, password } });
  return { ...r, token: r.json?.data?.accessToken, user: r.json?.data?.user };
};

/** Web'deki useActivityStream ile AYNI istek: fetch + ReadableStream + Bearer. */
function openStream(token) {
  const events = [];
  const ac = new AbortController();
  const ready = (async () => {
    const res = await fetch(`${GW}/logger/admin/activity-feed/stream`, { headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` }, signal: ac.signal });
    if (!res.ok || !res.body) return { status: res.status };
    (async () => {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const block of parts) {
            const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n');
            if (data) { try { events.push(JSON.parse(data)); } catch { /* yoksay */ } }
          }
        }
      } catch { /* abort */ }
    })();
    return { status: res.status, contentType: res.headers.get('content-type') };
  })();
  return { events, ready, close: () => ac.abort() };
}
async function waitFor(pred, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = pred();
    if (hit) return hit;
    await sleep(150);
  }
  return null;
}

console.log('=== Faz 3: aktivite akışı + system-pulse (gateway üzerinden) ===');
const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
check('admin girişi', admin.status === 200 && !!admin.token, `(${admin.status})`);

// ---- Yetki kapıları (akış açılmadan önce)
const noTok = await fetch(`${GW}/logger/admin/activity-feed/stream`);
check('tokensiz akış 401', noTok.status === 401, `(${noTok.status})`);
await noTok.body?.cancel();
const noTokPulse = await call('GET', '/logger/admin/system-pulse');
check('tokensiz system-pulse 401', noTokPulse.status === 401, `(${noTokPulse.status})`);

const roles = (await call('GET', '/identity/roles', { token: admin.token })).json?.data ?? [];
const roleId = (k) => roles.find((r) => r.kod === k)?.id;
const TEMP = 'Gecici-Parola-1';
const PERM = 'Kalici-Parola-7';
async function makeUser(email, rolKod) {
  const c = await call('POST', '/identity/users', { token: admin.token, body: { email, temporaryPassword: TEMP, roleId: roleId(rolKod) } });
  const first = await login(email, TEMP);
  await call('POST', '/identity/me/password', { token: first.token, body: { currentPassword: TEMP, newPassword: PERM } });
  return { created: c, session: await login(email, PERM) };
}
const ik = await makeUser('akis-ik@acme.test', 'ik_yoneticisi');
const kisi = await makeUser('akis-personel@acme.test', 'personel');

for (const [ad, u] of [['ik_yoneticisi', ik], ['personel', kisi]]) {
  const s = await fetch(`${GW}/logger/admin/activity-feed/stream`, { headers: { Authorization: `Bearer ${u.session.token}` } });
  check(`${ad}: aktivite akışı 403 (admin.audit_log yok)`, s.status === 403, `(${s.status})`);
  await s.body?.cancel();
  const p = await call('GET', '/logger/admin/system-pulse', { token: u.session.token });
  check(`${ad}: system-pulse 403`, p.status === 403, `(${p.status})`);
}
// G-26 teyidi: ik kullanıcı LİSTELER ama rol listesini göremez.
check('G-26 teyidi: ik_yoneticisi GET /identity/users 200', (await call('GET', '/identity/users', { token: ik.session.token })).status === 200);
check('G-26 teyidi: ik_yoneticisi GET /identity/roles 403 (rol seçici UI\'da boş kalır)', (await call('GET', '/identity/roles', { token: ik.session.token })).status === 403);

// ---- KABUL KRİTERİ: işlem -> akışta görünür
const stream = openStream(admin.token);
const opened = await stream.ready;
check('admin akışı açar (200, text/event-stream)', opened.status === 200 && /text\/event-stream/.test(opened.contentType ?? ''), `(${opened.status} ${opened.contentType})`);
await sleep(500); // abonelik otursun

const t0 = new Date().toISOString();
const EMAIL = 'akis-yeni@acme.test';
const created = await call('POST', '/identity/users', { token: admin.token, body: { email: EMAIL, temporaryPassword: TEMP, roleId: roleId('personel') } });
check('akış testi: kullanıcı oluşturuldu (201)', created.status === 201, `(${created.status})`);
const newUserId = created.json?.data?.id;
const evCreate = await waitFor(() => stream.events.find((e) => /oluşturuldu/.test(e.ozet ?? '') && (e.ozet ?? '').includes(EMAIL)));
check('KABUL: kullanıcı oluşturma aktivite akışında CANLI görünür', !!evCreate, `(akış olayları: ${stream.events.map((e) => e.ozet).join(' | ')})`);

const changedRole = await call('PATCH', `/identity/users/${newUserId}/role`, { token: admin.token, body: { roleId: roleId('ik_yoneticisi') } });
check('akış testi: rol değiştirildi (200)', changedRole.status === 200, `(${changedRole.status})`);
const evRole = await waitFor(() => stream.events.find((e) => /rolü .* olarak değiştirildi/.test(e.ozet ?? '') && e.createdAt > t0));
check('KABUL: rol değiştirme aktivite akışında CANLI görünür', !!evRole);
check('olay biçimi UI sözleşmesine uygun (id, service, eventType, ozet, severity, createdAt)', !!evCreate && ['id', 'service', 'eventType', 'ozet', 'severity', 'createdAt'].every((k) => typeof evCreate[k] === 'string'), JSON.stringify(evCreate ?? {}).slice(0, 200));
check('olayda aktör görünür: actorEmail = admin e-postası ("sistem" DEĞİL) ve actorUserId dolu', evCreate?.actorEmail === ADMIN_EMAIL && typeof evCreate?.actorUserId === 'string', `(actorEmail=${evCreate?.actorEmail})`);
check('akış hassas veri taşımaz (parola/hash yok)', !JSON.stringify(stream.events).match(/password_hash|Gecici-Parola|Kalici-Parola/));

// ---- system-pulse
const pulse = await call('GET', '/logger/admin/system-pulse', { token: admin.token });
const pd = pulse.json?.data;
check('system-pulse 200', pulse.status === 200, `(${pulse.status})`);
check('pulse: bugünkü işlem >= 4 ve aktif kullanıcı >= 1', pd?.todayActions >= 4 && pd?.activeUsersToday >= 1, JSON.stringify(pd));
check('pulse: son 24s oluşan >= 3 (bu koşuda 3 kullanıcı oluşturuldu)', pd?.last24h?.created >= 3, JSON.stringify(pd?.last24h));
check('pulse: geciken iş paketi null (G-27, 0 değil)', pd?.delayedWorkPackages === null);
check('pulse: sayısal alanlar ve truncated=false', ['todayActions', 'activeUsersToday'].every((k) => typeof pd?.[k] === 'number') && typeof pd?.truncated === 'boolean');

// ---- denetim detayı (Detay Gör)
const detail = await call('GET', `/logger/admin/audit-log/${evCreate?.id}`, { token: admin.token });
check('audit detayı 200 ve aynı kayıt', detail.status === 200 && detail.json?.data?.id === evCreate?.id, `(${detail.status})`);
check('audit detayı parola/hash sızdırmaz', !detail.text.match(/password_hash|Gecici-Parola|Kalici-Parola|\$2[aby]\$/));
const sample = detail.json?.data ?? {};
check('audit detayı UI alanlarını taşır (event_type, actor_email, onceki_deger, yeni_deger anahtarları)', ['event_type', 'actor_email', 'onceki_deger', 'yeni_deger', 'created_at'].every((k) => k in sample), Object.keys(sample).join(','));

// ---- kopma sonrası tamamlama sözleşmesi (useActivityStream backfill)
stream.close();
await sleep(300);
const gapStart = new Date().toISOString();
await call('PATCH', `/identity/users/${newUserId}/role`, { token: admin.token, body: { roleId: roleId('ekip_lideri') } });
await sleep(1500); // audit.event kuyruktan DB'ye insin
const back = await call('GET', `/logger/admin/audit-log?from=${encodeURIComponent(gapStart)}&pageSize=100`, { token: admin.token });
check('backfill: from=<son görülen> pageSize=100 kabul edilir (200)', back.status === 200, `(${back.status} ${JSON.stringify(back.json?.error)})`);
check('backfill: kopukluk sırasındaki rol değişikliği döner', (back.json?.data ?? []).some((a) => /rolü .* olarak değiştirildi/.test(a.ozet ?? '')));
check('backfill: from öncesi olay dönmez', (back.json?.data ?? []).every((a) => a.created_at >= gapStart));

console.log(`\nSONUÇ (Faz 3): ${pass} kontrol geçti, ${failures.length} başarısız`);
if (failures.length) {
  console.log(failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}
