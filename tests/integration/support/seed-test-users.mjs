/**
 * Day 18: entegrasyon testi için 3 kullanıcı + 1 kur kaydı ekler (SADECE test veritabanına —
 * gerçek bir ortamın seed'i değil; bkz. migrations/supabase/013_seed_data.sql'in "kullanıcı seed
 * edilmez" notu). Roller Day 17'nin seed'inden okunur.
 * Kullanım: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node seed-test-users.mjs
 */
import bcrypt from 'bcrypt';

const base = `${process.env.SUPABASE_URL}/rest/v1`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
export const TEST_PASSWORD = 'Passw0rd!Test';

async function rest(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const roles = await rest('/identity_roles?select=id,kod');
const roleId = (kod) => roles.find((r) => r.kod === kod)?.id;
const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

const users = [
  { email: 'admin@acme.test', role: 'sirket_yoneticisi', is_super_admin: true },
  { email: 'ik@acme.test', role: 'ik_yoneticisi', is_super_admin: false },
  { email: 'personel@acme.test', role: 'personel', is_super_admin: false },
];
await rest('/identity_users', {
  method: 'POST',
  headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
  body: JSON.stringify(users.map((u) => ({ email: u.email, password_hash: passwordHash, role_id: roleId(u.role), is_super_admin: u.is_super_admin, dil_tercihi: 'tr' }))),
});
await rest('/integration_exchange_rates?on_conflict=tarih', {
  method: 'POST',
  headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
  body: JSON.stringify([{ tarih: '2026-09-24', usd_try: 41.25, kaynak: 'TEST' }]),
});
console.log('test kullanıcıları + kur kaydı hazır');
