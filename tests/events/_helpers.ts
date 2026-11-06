import amqplib from 'amqplib';
import { RabbitMqClient } from '@pms/shared';

/**
 * Day 14: bu paket, Day 13'ün consumer testlerinden (fake `rabbit.subscribe`) FARKLI bir
 * doğrulama katmanı ekler — GERÇEK bir RabbitMQ broker'a karşı, GERÇEK `RabbitMqClient` ile.
 * `docker-compose.yml`'daki AYNI varsayılan kimlik bilgileri (`admin`/`secret`) kullanılır;
 * bu ortamda RabbitMQ apt-get ile kurulup doğrudan çalıştırıldı (Docker YOK bu kum havuzunda).
 */
export const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672';

export async function createConnectedClient(): Promise<RabbitMqClient> {
  const client = new RabbitMqClient(RABBITMQ_URL);
  await client.connect();
  return client;
}

/**
 * Testler arasında queue'da BİRİKMİŞ eski mesajların yeni bir çalıştırmayı kirletmemesi için —
 * gerçek servisin kullandığı AYNI kuyruk adını kullanıyoruz (bkz. her test dosyası), bu yüzden
 * her `it()` başında temizlemek gerekiyor.
 */
export async function purgeQueue(queueName: string): Promise<void> {
  const conn = await amqplib.connect(RABBITMQ_URL);
  conn.on('error', () => {}); // 404 (kuyruk henüz yok) kanal/bağlantı seviyesinde error event'i de fırlatır
  const ch = await conn.createChannel();
  ch.on('error', () => {});
  try {
    await ch.purgeQueue(queueName);
  } catch {
    // Kuyruk henüz yoksa (ilk çalıştırma) — sorun değil, subscribe() zaten oluşturacak.
  }
  await conn.close().catch(() => {});
}

/**
 * Gerçek broker üzerinden asenkron teslimat için basit bir polling bekleticisi.
 *
 * Day 15 eklendi: imza `() => boolean | Promise<boolean>` oldu (Day 14'te sadece senkron —
 * `() => sentEmails.length > 0` gibi bellek-içi kontroller yeterliydi). `tests/cache/`'in
 * predicate'leri GERÇEK Redis'ten `GET` okuyor, yani doğası gereği asenkron; `await
 * predicate()` HER İKİ durumda da doğru çalışır (senkron bir fonksiyonu `await`lemek de
 * güvenlidir) — bu yüzden Day 14'ün mevcut çağrıları (`tests/events/*.test.ts`) değişmeden
 * çalışmaya devam eder.
 */
export async function waitFor(predicate: () => boolean | Promise<boolean>, opts: { timeoutMs?: number; intervalMs?: number } = {}): Promise<void> {
  const { timeoutMs = 4000, intervalMs = 25 } = opts;
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: zaman aşımı — beklenen koşul gerçek broker üzerinden gerçekleşmedi');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
