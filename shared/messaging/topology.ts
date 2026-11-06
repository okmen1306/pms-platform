/**
 * RabbitMQ topoloji sözleşmesi — Q, Day 2 (bkz. docs/roadmap.md Bölüm 14.2 Q sütunu).
 *
 * Tek bir topic exchange kullanılır: "pms.events". Her servis kendi routing key'ine göre
 * ilgilendiği event'lere kuyruk bağlar (bkz. docs/roadmap.md Bölüm 7 Kuyruk Haritası).
 * Kuyruk adlandırma kuralı: "{servis-adi}.{amaç}" — örn. "notification-service.project-created".
 */
export const PMS_EVENTS_EXCHANGE = 'pms.events';
export const PMS_EVENTS_EXCHANGE_TYPE = 'topic';

/** Her servisin kendi kuyruğunu bağlarken kullanacağı isim üreticisi. */
export function queueName(service: string, purpose: string): string {
  return `${service}.${purpose}`;
}

/** Dead-letter exchange: işlenemeyen event'ler burada birikir, kaybolmaz. */
export const PMS_EVENTS_DLX = 'pms.events.dlx';
export const PMS_EVENTS_DLQ = 'pms.events.dlq';
