#!/usr/bin/env node
/**
 * Day 22 (G-13): sıfırdan kurulmuş ortamda İLK süper admin kullanıcısını oluşturur (UI'dan kullanıcı
 * oluşturmak için zaten bir admin gerekir — tavuk-yumurta). Migration + seed çalıştırılmış olmalı.
 *
 * Kullanım:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... FIRST_ADMIN_PASSWORD='...' \
 *     node scripts/create-first-admin.mjs --email yonetici@sirket.com
 *   echo 'Parola' | node scripts/create-first-admin.mjs --email ... --password-stdin
 * Parola komut satırı argümanı OLARAK ALINMAZ (shell geçmişi / `ps` çıktısına sızar).
 * Bayraklar: --allow-additional (zaten süper admin varsa, en fazla 3'e kadar bilerek ekler).
 * Gerekli: `npm run build -w @pms/shared` (parola politikası paylaşılan koddan gelir).
 */
import bcrypt from 'bcrypt';
import { createRequire } from 'node:module';
import { createFirstAdmin, FirstAdminError } from './lib/first-admin.mjs';

const require = createRequire(import.meta.url);
const { validatePasswordPolicy } = require('../shared/dist');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

if (args.includes('--password')) {
  console.error('HATA: --password argümanı desteklenmez (güvenlik). FIRST_ADMIN_PASSWORD ortam değişkenini veya --password-stdin kullanın.');
  process.exit(2);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
  process.exit(2);
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, '');
}
const password = flag('--password-stdin') ? await readStdin() : process.env.FIRST_ADMIN_PASSWORD;

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

try {
  const admin = await createFirstAdmin({
    rest,
    hash: (p) => bcrypt.hash(p, 10),
    validatePasswordPolicy,
    email: value('--email'),
    password,
    allowAdditional: flag('--allow-additional'),
  });
  console.log(`İlk süper admin oluşturuldu: ${admin.email} (id: ${admin.id})`);
} catch (e) {
  console.error(`HATA: ${e instanceof FirstAdminError ? e.message : `beklenmeyen hata — ${e.message}`}`);
  process.exit(1);
}
