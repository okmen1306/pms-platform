import { AUDIT_EVENTS } from '../events/audit.events';
/**
 * Her serviste tek satırla kurulan audit publisher factory'si. "Admin uçan kuştan bile
 * haberdar olmalı" kuralının (docs/roadmap.md Bölüm 17.4) tüm servislerde AYNI ŞEKİLDE
 * uygulanmasını garanti eder — her servis kendi publish mantığını yeniden yazmaz.
 *
 * Kullanım (herhangi bir serviste):
 *   const publishAudit = createAuditPublisher(rabbit, 'identity-service');
 *   await publishAudit({ eventType: 'LOGIN', ... });
 */
export function createAuditPublisher(rabbit, serviceName) {
    return async (event) => {
        const fullEvent = { service: serviceName, ...event };
        await rabbit.publish(AUDIT_EVENTS.GENERIC, fullEvent);
    };
}
