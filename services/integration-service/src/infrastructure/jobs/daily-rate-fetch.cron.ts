import cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import { fetchAndStoreTodayRate, type FetchTcmbRateDeps } from '../../core/use-cases/fetch-tcmb-rate.usecase';

/**
 * Her gün TCMB'nin kuru yayınladığı saatten (yaklaşık 15:30) sonra çalışır.
 * RATE_FETCH_CRON env değişkeni ile ayarlanabilir (varsayılan: her gün 16:00).
 */
export function scheduleDailyRateFetch(deps: FetchTcmbRateDeps, cronExpr: string, logger: FastifyBaseLogger) {
  cron.schedule(cronExpr, async () => {
    try {
      await fetchAndStoreTodayRate(deps);
      logger.info('TCMB kuru başarıyla güncellendi');
    } catch (err) {
      // Hafta sonu/resmi tatil günlerinde TCMB veri yayınlamaz — bu BEKLENEN bir durumdur,
      // servis çökmez, sadece uyarı loglanır (kural: docs/roadmap.md madde 4).
      logger.warn({ err }, 'TCMB kuru bugün alınamadı (tatil/hafta sonu olabilir)');
    }
  });
}
