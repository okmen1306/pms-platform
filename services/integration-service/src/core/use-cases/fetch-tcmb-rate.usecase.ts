import type { TcmbAdapter } from '../../infrastructure/providers/tcmb.adapter';
import type { ExchangeRateRepository } from '../../infrastructure/database/exchange-rate.repository';

export interface FetchTcmbRateDeps {
  tcmbAdapter: TcmbAdapter;
  exchangeRateRepo: ExchangeRateRepository;
  publishExchangeRateUpdated: (event: { date: string; usdTry: number; source: string }) => Promise<void>;
}

/**
 * Kural (docs/roadmap.md madde 4): USD/TRY kuru TCMB kaynaklı, periyodik olarak otomatik çekilir.
 * TCMB satışa kapalı günlerde (hafta sonu/tatil) veri yayınlamaz — bu durumda en son bilinen
 * kur korunur (upsert yapılmaz), servis çökmez. Hatanın YAKALANIP loglanması VE yutulması
 * burada değil, çağıran `cron.ts`'te olur — bu yüzden burada try/catch YOK (Q, Day 8: eskiden
 * burada `catch (err) { throw err; }` şeklinde işlevsiz bir sarmalayıcı vardı, `no-useless-catch`
 * kuralına takılıyordu; yorum "sadece loglanır" diyordu ama loglama zaten HİÇ burada değildi).
 */
export async function fetchAndStoreTodayRate(deps: FetchTcmbRateDeps): Promise<void> {
  const result = await deps.tcmbAdapter.fetchTodayRate();
  await deps.exchangeRateRepo.upsertForDate(result.tarih, result.usdTry, 'TCMB');
  await deps.publishExchangeRateUpdated({ date: result.tarih, usdTry: result.usdTry, source: 'TCMB' });
}
