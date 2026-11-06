import { z } from 'zod';
/**
 * Kural (docs/roadmap.md Bölüm 7, "audit.event, teknik `log.event`'ten ayrıdır"): bu event
 * TEKNİK hata/log kayıtları için — kullanıcı eylemlerinin denetim kaydı DEĞİL (o `audit.event`).
 * Bugün itibarıyla (Day 10) HİÇBİR servis bunu YAYINLAMIYOR — sadece logger-service'in tüketici
 * tarafı (log-event.consumer.ts) hazır (roadmap'in "consumer, üreticiden önce" deseni, bkz.
 * CHANGELOG.md Day 6/8/9 notları). Bir servisin kendi hata yakalama/log akışını bu event'e
 * bağlaması ayrı, henüz hiçbir güne atanmamış bir iş.
 */
export const LogEventSchema = z.object({
    level: z.enum(['info', 'warning', 'error', 'fatal']),
    service: z.string(),
    message: z.string(),
    meta: z.record(z.unknown()).nullable().optional(),
});
export const LOG_EVENTS = {
    GENERIC: 'log.event',
};
