import { ValidationError, type AuditPublisherFn } from '@pms/shared';
import type { PerformanceScoreRepository, CriterionRow } from '../../infrastructure/database/score.repository';

/**
 * Kural (docs/roadmap.md Bölüm 9.4): kriterlerin ağırlık yüzdeleri toplamı 100'ü GEÇEMEZ
 * (tam olarak 100 olma zorunluluğu go-live checklist'te — Bölüm 16 — ayrıca doğrulanır,
 * burada geliştirme sürecinde esneklik için sadece "aşmama" kontrol edilir).
 */
export async function createCriterion(
  input: { ad: string; agirlikYuzdesi: number },
  actorUserId: string,
  repo: PerformanceScoreRepository,
  publishAudit: AuditPublisherFn,
): Promise<CriterionRow> {
  const currentTotal = await repo.totalActiveWeight();
  if (currentTotal + input.agirlikYuzdesi > 100) {
    throw new ValidationError(
      `Toplam ağırlık %100'ü aşıyor (mevcut: %${currentTotal}, eklenen: %${input.agirlikYuzdesi})`,
    );
  }

  const created = await repo.createCriterion({ ad: input.ad, agirlik_yuzdesi: input.agirlikYuzdesi });

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'performance_criteria',
    entityId: created.id,
    ozet: `"${created.ad}" performans kriteri eklendi (%${created.agirlik_yuzdesi}).`,
    severity: 'info',
  });

  return created;
}

export async function listCriteria(repo: PerformanceScoreRepository): Promise<CriterionRow[]> {
  return repo.listCriteria();
}
