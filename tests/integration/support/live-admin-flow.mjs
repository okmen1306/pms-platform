/**
 * Day 22 (Q): gerçek gateway + gerçek identity-service + gerçek PostgreSQL/PostgREST'e karşı
 * (1) Day 21'den devreden CANLI RBAC matrisi, (2) kullanıcı yönetimi akışı.
 * Çıkış kodu = başarısız kontrol sayısı > 0 ise 1. Çalıştırıcı: run-admin-verification.sh
 * Ortam: GATEWAY, ADMIN_EMAIL, ADMIN_PASSWORD.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GW = process.env.GATEWAY ?? 'http://127.0.0.1:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const here = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) pass++;
  else {
    failures.push(`${name} ${detail}`);
    console.log(`  ✗ ${name} ${detail}`);
  }
}

async function call(method, url, { token, body, headers = {} } = {}) {
  const res = await fetch(`${GW}${url}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* gövde JSON değil */ }
  return { status: res.status, json };
}
const login = async (email, password) => {
  const r = await call('POST', '/identity/auth/login', { body: { email, password } });
  return { ...r, token: r.json?.data?.accessToken, user: r.json?.data?.user };
};

// ---------------------------------------------------------------- Faz 1: ilk admin + kullanıcı yönetimi
console.log('=== Faz 1: ilk admin girişi ve kullanıcı yönetimi ===');
const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
check('create-first-admin ile oluşan admin giriş yapar', admin.status === 200 && !!admin.token, `(${admin.status})`);
check('ilk admin süper admin ve sirket_yoneticisi', admin.user?.isSuperAdmin === true && admin.user?.roleKod === 'sirket_yoneticisi');
check('ilk admin için mustChangePassword=false', admin.user?.mustChangePassword === false);

const roles = (await call('GET', '/identity/roles', { token: admin.token })).json?.data ?? [];
const roleId = (kod) => roles.find((r) => r.kod === kod)?.id;
check('5 seed rol canlı DB\'de mevcut, satis yok', ['sirket_yoneticisi', 'ekip_lideri', 'ik_yoneticisi', 'satinalma_personeli', 'personel'].every((k) => roleId(k)) && !roleId('satis'));

const TEMP = 'Gecici-Parola-1';
const people = {
  ik: ['ik@acme.test', 'ik_yoneticisi'],
  ekip: ['ekip@acme.test', 'ekip_lideri'],
  satinalma: ['satinalma@acme.test', 'satinalma_personeli'],
  personel: ['personel@acme.test', 'personel'],
};
const ids = {};
for (const [k, [email, rol]] of Object.entries(people)) {
  const r = await call('POST', '/identity/users', { token: admin.token, body: { email, temporaryPassword: TEMP, roleId: roleId(rol) } });
  check(`admin ${email} kullanıcısını ${rol} rolüyle oluşturur (201)`, r.status === 201, `(${r.status} ${JSON.stringify(r.json?.error)})`);
  ids[k] = r.json?.data?.id;
  check(`${k}: yanıt password_hash içermez, mustChangePassword=true`, !JSON.stringify(r.json).includes('password_hash') && r.json?.data?.mustChangePassword === true);
}

// Geçici parola ile giriş -> bayrak -> parola değiştirme -> yeni parola
const tempLogin = await login(people.personel[0], TEMP);
check('geçici parolayla giriş yapılır ve mustChangePassword=true döner', tempLogin.status === 200 && tempLogin.user?.mustChangePassword === true);
const blocked = await call('GET', '/project/projects', { token: tempLogin.token });
check('GEÇİCİ PAROLA ZORLAMASI: bayraklı token ile iş uçları 403 PASSWORD_CHANGE_REQUIRED', blocked.status === 403 && blocked.json?.error?.code === 'PASSWORD_CHANGE_REQUIRED', `(${blocked.status} ${blocked.json?.error?.code})`);
const blockedAdminGate = await call('GET', '/identity/roles', { token: tempLogin.token });
check('...admin uçları da aynı kodla kapalı (izin kapısından ÖNCE devreye girer)', blockedAdminGate.json?.error?.code === 'PASSWORD_CHANGE_REQUIRED');
check('...ama kendi izinlerini okuyabilir (200)', (await call('GET', '/identity/me/effective-permissions', { token: tempLogin.token })).status === 200);
const weak = await call('POST', '/identity/me/password', { token: tempLogin.token, body: { currentPassword: TEMP, newPassword: 'zayif' } });
check('zayıf yeni parola 422', weak.status === 422, `(${weak.status})`);
const wrongCur = await call('POST', '/identity/me/password', { token: tempLogin.token, body: { currentPassword: 'Yanlis-Parola-9', newPassword: 'Yeni-Parola-42' } });
check('yanlış mevcut parola 401', wrongCur.status === 401, `(${wrongCur.status})`);
const NEWPW = 'Yeni-Parola-42';
const changed = await call('POST', '/identity/me/password', { token: tempLogin.token, body: { currentPassword: TEMP, newPassword: NEWPW } });
check('personel (admin izni YOK) kendi parolasını değiştirir (200)', changed.status === 200, `(${changed.status})`);
check('eski geçici parola artık geçersiz (401)', (await login(people.personel[0], TEMP)).status === 401);
const staleToken = await call('GET', '/project/projects', { token: tempLogin.token });
check('parola değişince ESKİ token hâlâ bayraklı (yeniden giriş gerekir) — belgelenmiş davranış', staleToken.status === 403 && staleToken.json?.error?.code === 'PASSWORD_CHANGE_REQUIRED');
const after = await login(people.personel[0], NEWPW);
check('yeniden girişte iş uçları açık (artık PASSWORD_CHANGE_REQUIRED yok)', (await call('GET', '/project/projects', { token: after.token })).json?.error?.code !== 'PASSWORD_CHANGE_REQUIRED');
check('yeni parolayla giriş, mustChangePassword=false', after.status === 200 && after.user?.mustChangePassword === false);

// Gerçek akış: her yeni kullanıcı önce geçici parolasını değiştirir (aksi hâlde gateway bayraklı token'ı keser).
const PERM_PW = 'Kalici-Parola-7';
async function activate(email) {
  const first = await login(email, TEMP);
  const ch = await call('POST', '/identity/me/password', { token: first.token, body: { currentPassword: TEMP, newPassword: PERM_PW } });
  check(`${email} geçici parolasını değiştirir`, ch.status === 200, `(${ch.status})`);
  return login(email, PERM_PW);
}
const activated = {};
for (const k of ['ik', 'ekip', 'satinalma']) activated[k] = await activate(people[k][0]);

// İK: spec "ik_yoneticisi POST /users"
const ik = activated.ik;
const ikList = await call('GET', '/identity/users?role=personel', { token: ik.token });
check('ik GET /identity/users?role=personel 200 ve yalnızca personel rolü', ikList.status === 200 && ikList.json.data.every((u) => u.roleKod === 'personel') && ikList.json.data.length === 1, `(${ikList.status})`);
const ikCreates = await call('POST', '/identity/users', { token: ik.token, body: { email: 'yeni.personel@acme.test', temporaryPassword: TEMP, roleId: roleId('personel') } });
check('ik_yoneticisi personel hesabı açabilir (201)', ikCreates.status === 201, `(${ikCreates.status} ${JSON.stringify(ikCreates.json?.error)})`);
const esc = await call('POST', '/identity/users', { token: ik.token, body: { email: 'kacak.admin@acme.test', temporaryPassword: TEMP, roleId: roleId('sirket_yoneticisi') } });
check('YETKİ YÜKSELTME: ik sirket_yoneticisi hesabı AÇAMAZ (403)', esc.status === 403, `(${esc.status})`);
const escLookup = (await call('GET', '/identity/users', { token: admin.token })).json?.data ?? [];
check('...ve o kullanıcı DB\'de yok', !escLookup.some((u) => u.email.startsWith('kacak')));
const ikRole = await call('PATCH', `/identity/users/${ids.personel}/role`, { token: ik.token, body: { roleId: roleId('ekip_lideri') } });
check('ik rol DEĞİŞTİREMEZ (gateway admin.roles.manage, 403)', ikRole.status === 403, `(${ikRole.status})`);
const ikRoles = await call('GET', '/identity/roles', { token: ik.token });
check('ik /identity/roles okuyamaz (403)', ikRoles.status === 403);
const dup = await call('POST', '/identity/users', { token: admin.token, body: { email: 'IK@acme.test', temporaryPassword: TEMP, roleId: roleId('personel') } });
check('aynı e-posta (büyük harfle) 409', dup.status === 409, `(${dup.status})`);

// Rol değiştirme + etkisi
// me/effective-permissions TÜM kataloğu bayraklarla döner (web `canView`/`canEdit`e bakar) — yalnızca verilenler sayılır.
const granted = (res) => (res.json?.data ?? []).filter((p) => p.canView).map((p) => p.permissionKey).sort();
const before = granted(await call('GET', '/identity/me/effective-permissions', { token: after.token }));
check('personel başlangıçta yalnızca 3 izne sahip', JSON.stringify(before) === JSON.stringify(['performance.score', 'project.records', 'risk.analysis']), JSON.stringify(before));
const selfRole = await call('PATCH', `/identity/users/${admin.user.id}/role`, { token: admin.token, body: { roleId: roleId('personel') } });
check('admin kendi rolünü değiştiremez (409)', selfRole.status === 409, `(${selfRole.status})`);
const promote = await call('PATCH', `/identity/users/${ids.personel}/role`, { token: admin.token, body: { roleId: roleId('ekip_lideri') } });
check('admin rol değiştirir (200)', promote.status === 200, `(${promote.status})`);
const perms2 = granted(await call('GET', '/identity/me/effective-permissions', { token: after.token }));
check('rol değişikliği MEVCUT token\'la bile hemen etkili: personel artık reports.view görür', perms2.includes('reports.view') && !before.includes('reports.view'));
const reports = await call('GET', '/reporting/reports/workflow?projectId=00000000-0000-0000-0000-000000000001', { token: after.token });
check('...ve /reporting kapısı açıldı (artık 403 değil)', reports.status !== 403, `(${reports.status})`);
await call('PATCH', `/identity/users/${ids.personel}/role`, { token: admin.token, body: { roleId: roleId('personel') } });

// Override: ver -> görünür mü -> geri al
const catalog = (await call('GET', '/identity/permissions', { token: admin.token })).json?.data ?? [];
const finPerm = catalog.find((p) => p.permission_key === 'finance.cost_analysis' || p.permissionKey === 'finance.cost_analysis');
check('izin kataloğu canlı DB\'den 15 anahtar döner', catalog.length === 15, `(${catalog.length})`);
const fin0 = await call('GET', `/finance/projects/00000000-0000-0000-0000-000000000001/costs`, { token: after.token });
check('override ÖNCESİ personel finance 403', fin0.status === 403, `(${fin0.status})`);
const grant = await call('POST', `/identity/users/${ids.personel}/permission-overrides`, {
  token: admin.token, body: { permissionId: finPerm?.id, canView: true, canEdit: false, gerekce: 'Canlı doğrulama: geçici maliyet erişimi' },
});
check('override verilir (200/201)', [200, 201].includes(grant.status), `(${grant.status} ${JSON.stringify(grant.json?.error)})`);
const fin1 = await call('GET', `/finance/projects/00000000-0000-0000-0000-000000000001/costs`, { token: after.token });
check('override SONRASI personel finance görür (artık 403 değil)', fin1.status !== 403, `(${fin1.status})`);
const finWrite = await call('POST', `/finance/projects/00000000-0000-0000-0000-000000000001/costs`, { token: after.token, body: {} });
check('override yalnızca VIEW verdi: yazma hâlâ 403', finWrite.status === 403, `(${finWrite.status})`);
const overrides = (await call('GET', `/identity/users/${ids.personel}/permission-overrides`, { token: admin.token })).json?.data ?? [];
const ovId = overrides[0]?.id;
const revoke = await call('DELETE', `/identity/users/${ids.personel}/permission-overrides/${ovId}`, { token: admin.token });
check('override geri alınır', [200, 204].includes(revoke.status), `(${revoke.status})`);
const fin2 = await call('GET', `/finance/projects/00000000-0000-0000-0000-000000000001/costs`, { token: after.token });
check('geri alma SONRASI personel finance yine 403', fin2.status === 403, `(${fin2.status})`);

// Rol güncelleme
const created = await call('POST', '/identity/roles', { token: admin.token, body: { kod: 'canli_test', ad: 'Canlı Test Rolü' } });
const roleRename = await call('PATCH', `/identity/roles/${created.json?.data?.id}`, { token: admin.token, body: { ad: 'Canlı Test (yeni ad)' } });
check('PATCH /identity/roles/:id ad günceller (200)', roleRename.status === 200 && roleRename.json?.data?.ad === 'Canlı Test (yeni ad)', `(${roleRename.status})`);
const sysDeact = await call('PATCH', `/identity/roles/${roleId('sirket_yoneticisi')}`, { token: admin.token, body: { aktif: false } });
check('sistem rolü pasife alınamaz (409)', sysDeact.status === 409, `(${sysDeact.status})`);
const busyDeact = await call('PATCH', `/identity/roles/${roleId('satinalma_personeli')}`, { token: admin.token, body: { aktif: false } });
check('kullanıcısı olan rol pasife alınamaz (409)', busyDeact.status === 409, `(${busyDeact.status})`);

// Audit zinciri
await new Promise((r) => setTimeout(r, 1500));
const audit = await call('GET', '/logger/admin/audit-log?pageSize=100', { token: admin.token });
const ozetler = (audit.json?.data ?? []).map((a) => a.ozet ?? '').join('\n');
check('audit: kullanıcı oluşturma kaydı', /kullanıcısı .* rolüyle oluşturuldu/.test(ozetler));
check('audit: rol değiştirme kaydı', /rolü .* olarak değiştirildi/.test(ozetler));
check('audit: parola değiştirme kaydı', /parolasını değiştirdi/.test(ozetler));

// ---------------------------------------------------------------- Faz 2: canlı RBAC matrisi (Day 21'den devreden)
console.log('=== Faz 2: canlı RBAC matrisi (docs/testing/rbac-matrix.md) ===');
const md = fs.readFileSync(path.resolve(here, '../../../docs/testing/rbac-matrix.md'), 'utf8');
const block = md.split('<!-- RBAC-MATRIX:BEGIN -->')[1].split('<!-- RBAC-MATRIX:END -->')[0];
const rows = block.split('\n').filter((l) => l.startsWith('| /')).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const ROLE_ORDER = ['sirket_yoneticisi', 'ekip_lideri', 'ik_yoneticisi', 'satinalma_personeli', 'personel'];
const tokens = { sirket_yoneticisi: admin.token };
// Roller: temiz kullanıcılar — personel rolünü yukarıda geri aldık; ekip/ik/satinalma ilk haldeler.
tokens.ekip_lideri = activated.ekip.token;
tokens.ik_yoneticisi = activated.ik.token;
tokens.satinalma_personeli = activated.satinalma.token;
tokens.personel = (await login(people.personel[0], NEWPW)).token;
check('5 rolün tamamı için gerçek JWT alındı', ROLE_ORDER.every((r) => !!tokens[r]));

const SAMPLE = '00000000-0000-0000-0000-0000000000ee';
let cells = 0;
for (const [prefix, key, ...perRole] of rows) {
  const url = prefix.includes('/salary') ? `/personnel/employees/${SAMPLE}/salary` : `${prefix}/probe`;
  for (let i = 0; i < ROLE_ORDER.length; i++) {
    const [read, write] = perRole[i].split('/');
    const rol = ROLE_ORDER[i];
    const g = await call('GET', url, { token: tokens[rol] });
    const gateOpen = g.status !== 403 && g.status !== 401;
    check(`${rol} GET ${prefix}`, read === '200' ? gateOpen : g.status === 403 && g.json?.error?.code === 'FORBIDDEN_PAGE_ACCESS', `(beklenen ${read}, gerçek ${g.status})`);
    cells++;
    if (write !== '-') {
      const w = await call('POST', url, { token: tokens[rol], body: {} });
      const open = w.status !== 403 && w.status !== 401;
      check(`${rol} POST ${prefix}`, write === '200' ? open : w.status === 403 && w.json?.error?.code === 'FORBIDDEN_PAGE_ACCESS', `(beklenen ${write}, gerçek ${w.status})`);
      cells++;
    }
  }
}
console.log(`  RBAC hücresi denendi: ${cells}`);

console.log(`\nSONUÇ: ${pass} kontrol geçti, ${failures.length} başarısız`);
if (failures.length) {
  console.log(failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}
