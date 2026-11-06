/**
 * Day 22 (G-13): ilk-admin bootstrap mantığı — I/O dışarıdan enjekte edilir (`rest`, `hash`,
 * `validatePasswordPolicy`) ki PostgREST olmadan test edilebilsin (tests/scripts/first-admin.test.ts).
 */
export class FirstAdminError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SUPER_ADMIN_LIMIT = 3; // 001_identity_tables.sql: trg_super_admin_limit ile AYNI sayı

export async function createFirstAdmin({ rest, hash, validatePasswordPolicy, email, password, allowAdditional = false }) {
  const mail = String(email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) throw new FirstAdminError(`Geçersiz e-posta: "${email}"`);
  const problems = validatePasswordPolicy(String(password ?? ''));
  if (problems.length > 0) throw new FirstAdminError(`Parola politikasına uymuyor: ${problems.join(' ')}`);

  const roles = await rest(`/identity_roles?select=id&kod=eq.sirket_yoneticisi`);
  if (!roles?.length) {
    throw new FirstAdminError('"sirket_yoneticisi" rolü bulunamadı — önce migration + 013_seed_data.sql çalıştırılmalı.');
  }

  const existing = await rest(`/identity_users?select=id&email=eq.${encodeURIComponent(mail)}`);
  if (existing?.length) throw new FirstAdminError(`Bu e-posta ile bir kullanıcı zaten var: ${mail}`);

  const admins = await rest(`/identity_users?select=id&is_super_admin=eq.true`);
  if (admins.length >= SUPER_ADMIN_LIMIT) {
    throw new FirstAdminError(`Süper admin sınırına ulaşıldı (${SUPER_ADMIN_LIMIT}). Yeni süper admin eklenemez.`);
  }
  if (admins.length > 0 && !allowAdditional) {
    throw new FirstAdminError(
      `Sistemde zaten ${admins.length} süper admin var; bu script "İLK" admin içindir. Bilerek eklemek için --allow-additional verin.`,
    );
  }

  let created;
  try {
    created = await rest('/identity_users', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        email: mail,
        password_hash: await hash(password),
        role_id: roles[0].id,
        is_super_admin: true,
        dil_tercihi: 'tr',
        // Parolayı operatör kendisi seçti (geçici parola değil) — ilk girişte değiştirme zorlanmaz.
        must_change_password: false,
      }),
    });
  } catch (e) {
    // DB tetikleyicisi yarışta (aynı anda iki script) sınırı yine de korur.
    if (/super-admin|3 super/i.test(String(e?.message))) throw new FirstAdminError('Süper admin sınırı DB tarafından reddedildi.');
    throw e;
  }
  return { id: created?.[0]?.id, email: mail };
}
