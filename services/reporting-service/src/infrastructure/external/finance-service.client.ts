import { NotFoundError } from '@pms/shared';

/**
 * B3 (Day 12): "reporting: ... malzeme-maliyeti ... endpoint'leri". reporting-service KENDİ
 * malzeme maliyeti verisini TUTMAZ/HESAPLAMAZ (roadmap.md Bölüm 4.10'daki CQRS şemasında bu tür
 * bir tablo YOK) — finance-service (Day 8'den beri `material.purchased` consumer'ıyla)
 * OTORİTER kaynak. `material-cost-report.controller.ts`, bu istemciyle finance-service'in
 * ZATEN VAR OLAN `GET /finance/projects/:id/costs`ına ince bir proxy'dir (roadmap dosya
 * ağacında `material-cost-report.controller.ts` için ayrı bir use-case PLANLANMAMIŞ — audit-
 * log.controller.ts (Day 11) ile AYNI "saf okuma, use-case katmanı yok" deseni).
 */
export class FinanceServiceClient {
  constructor(private readonly baseUrl: string) {}

  async getMaterialCost(projectId: string): Promise<{ malzemeMaliyetiTl: number; malzemeMaliyetiUsd: number }> {
    const response = await fetch(new URL(`/finance/projects/${projectId}/costs`, this.baseUrl));
    if (!response.ok) {
      throw new NotFoundError('Maliyet kaydı', projectId);
    }
    const body = (await response.json()) as { data: { malzeme_maliyeti_tl: number; malzeme_maliyeti_usd: number } };
    return { malzemeMaliyetiTl: body.data.malzeme_maliyeti_tl, malzemeMaliyetiUsd: body.data.malzeme_maliyeti_usd };
  }
}
