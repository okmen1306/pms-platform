import type { RabbitMqClient } from './rabbitmq.client';
import { AUDIT_EVENTS, type AuditEvent, type AuditPublisherFn } from '../events/audit.events';

/**
 * Her serviste tek satırla kurulan audit publisher factory'si. "Admin uçan kuştan bile
 * haberdar olmalı" kuralının (docs/roadmap.md Bölüm 17.4) tüm servislerde AYNI ŞEKİLDE
 * uygulanmasını garanti eder — her servis kendi publish mantığını yeniden yazmaz.
 *
 * Kullanım (herhangi bir serviste):
 *   const publishAudit = createAuditPublisher(rabbit, 'identity-service');
 *   await publishAudit({ eventType: 'LOGIN', ... });
 */
export function createAuditPublisher(rabbit: RabbitMqClient, serviceName: string): AuditPublisherFn {
  return async (event: Omit<AuditEvent, 'service'>) => {
    const fullEvent: AuditEvent = { service: serviceName, ...event };
    await rabbit.publish(AUDIT_EVENTS.GENERIC, fullEvent);
  };
}
