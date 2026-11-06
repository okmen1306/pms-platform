/**
 * Day 22 (G-02): parola politikası TEK yerde — identity-service (POST /users, parola değiştirme) ve
 * `scripts/create-first-admin.mjs` aynı fonksiyonu kullanır. Üst sınır 72 BAYT: bcrypt daha uzun
 * girdiyi SESSİZCE keser (iki farklı uzun parola aynı hash'e düşebilir) — bu yüzden reddedilir.
 * Boş dizi = politikaya uygun.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;

export function validatePasswordPolicy(password: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push(`Parola en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`);
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) errors.push(`Parola en fazla ${PASSWORD_MAX_BYTES} bayt olabilir.`);
  if (!/[a-zçğıöşü]/.test(password)) errors.push('Parola en az bir küçük harf içermeli.');
  if (!/[A-ZÇĞİÖŞÜ]/.test(password)) errors.push('Parola en az bir büyük harf içermeli.');
  if (!/[0-9]/.test(password)) errors.push('Parola en az bir rakam içermeli.');
  return errors;
}
