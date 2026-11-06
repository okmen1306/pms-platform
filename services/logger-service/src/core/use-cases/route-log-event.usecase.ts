import type { LogEvent } from '@pms/shared';
import type { ErrorEventRepository, ErrorEventRow } from '../../infrastructure/database/error-log.repository';
import type { AlertAdapter } from '../../infrastructure/providers/telegram.adapter';

/**
 * TL (Day 10): "teknik hata -> Telegram/Sentry" (roadmap'in kendi dosya ağacındaki yorum,
 * bkz. route-log-event.usecase.ts dosya adı). Her seviye DB'ye kaydedilir (kalıcı, aranabilir
 * kayıt) ama Telegram'a SADECE `error`/`fatal` gönderilir — Uzman İnisiyatifi: roadmap bir eşik
 * belirtmiyor, ama `info`/`warning` seviyesindeki her teknik logu Telegram'a basmak (muhtemelen
 * saniyede birden fazla) admin'in bildirim akışını anlamsız kılar; "uçan kuştan haberdar olma"
 * ilkesi (Bölüm 17.4) ANLAMLI/İSTİSNAİ olaylar için tasarlanmış, gürültü için değil.
 */
export async function routeLogEvent(
  event: LogEvent,
  errorRepo: ErrorEventRepository,
  alertAdapter: AlertAdapter,
): Promise<ErrorEventRow> {
  const saved = await errorRepo.insert({
    service: event.service,
    level: event.level,
    message: event.message,
    meta: event.meta ?? null,
  });

  if (event.level === 'error' || event.level === 'fatal') {
    const emoji = event.level === 'fatal' ? '🔴' : '🟠';
    await alertAdapter.send(`${emoji} <b>${event.service}</b> [${event.level.toUpperCase()}]\n${event.message}`);
  }

  return saved;
}
