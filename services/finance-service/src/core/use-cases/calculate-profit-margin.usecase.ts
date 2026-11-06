import { NotFoundError } from '@pms/shared';
import type { CostRepository } from '../../infrastructure/database/cost.repository';

export interface ProfitMarginResult {
  satisFiyatiTl: number | null;
  toplamGerceklesenMaliyetTl: number;
  toplamTahminiMaliyetTl: number;
  karMarjiYuzde: number | null;
}

/**
 * B2 (Day 10): "finance tamamlama". docs/roadmap.md Bölüm 8'in finance-service uç nokta
 * listesinde `GET /finance/projects/:id/profit-margin` PLANLIydı ama `cost-analysis.controller.ts`
 * (Day 6) yalnızca `/costs` ve (Day 7) `/personnel-weekly-cost`'u eklemişti — kendi yorumunda
 * "Day 7-10'da eklenecek" diyordu, bugün (Day 10, aralığın son günü) tamamlandı.
 *
 * `/costs` ZATEN `kar_marji_yuzde`'yi de döndürüyor (kalem bazlı dökümle birlikte) — bu uç nokta
 * onun YERİNE geçmiyor, roadmap'in kendi tasarımı gereği ayrı, DAHA ODAKLI bir projeksiyon
 * sunuyor (örn. sadece kâr marjı widget'ı gösteren bir ekran, tüm kalem dökümünü indirmek
 * zorunda kalmasın).
 */
export async function calculateProfitMargin(projectId: string, costRepo: CostRepository): Promise<ProfitMarginResult> {
  const cost = await costRepo.findByProject(projectId);
  if (!cost) throw new NotFoundError('Maliyet kaydı', projectId);

  return {
    satisFiyatiTl: cost.satis_fiyati_tl,
    toplamGerceklesenMaliyetTl: cost.toplam_gerceklesen_maliyet_tl,
    toplamTahminiMaliyetTl: cost.toplam_tahmini_maliyet_tl,
    karMarjiYuzde: cost.kar_marji_yuzde,
  };
}
