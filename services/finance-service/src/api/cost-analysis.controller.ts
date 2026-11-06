import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, NotFoundError } from '@pms/shared';
import type { CostRepository } from '../infrastructure/database/cost.repository';
import { calculateProfitMargin } from '../core/use-cases/calculate-profit-margin.usecase';
import { calculateTeamCostSummary } from '../core/use-cases/calculate-team-cost-summary.usecase';

/**
 * Day 6: sadece iskelet endpoint (mevcut maliyet kaydını okur). Bölüm 8 API şartnamesindeki
 * `/finance/projects/:id/personnel-weekly-cost`, `/team-cost-summary`, `/profit-margin`
 * endpoint'leri Day 7-10'da hesaplama mantığıyla birlikte eklenecek — B2 (Day 10) ile bu üçü
 * TAMAMLANDI (personnel-weekly-cost Day 7'de, diğer ikisi bugün).
 *
 * ÖNEMLİ NOT (madde: "sadece Şirket Yöneticisi görebilir"): bu route'lar RBAC middleware'i
 * Day 6-8'de api-gateway'e bağlandığında `finance.cost_analysis` izniyle korunacak; şimdilik
 * servis kendi başına (gateway arkasında olmadan) test edilebilir durumda.
 */
export function registerCostAnalysisRoutes(app: FastifyInstance, deps: { costRepo: CostRepository }) {
  app.get('/finance/projects/:id/costs', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const cost = await deps.costRepo.findByProject(id);
    if (!cost) throw new NotFoundError('Maliyet kaydı', id);
    return ok(cost);
  });

  /**
   * Day 7: AR-GE maliyeti haftalık dökümü (F2 — ArgeCostPage). `ayni_hafta_proje_sayisi` > 1
   * olan satırlar, frontend'de "bu personel bu hafta N projede görevli, maliyeti bölünmüş"
   * uyarısıyla gösterilir (bkz. web/src/features/finance/ArgeCostPage.tsx).
   */
  app.get('/finance/projects/:id/personnel-weekly-cost', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const items = await deps.costRepo.listWeeklyCostsByProject(id);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  // B2 (Day 10): "finance tamamlama" — bkz. calculate-team-cost-summary.usecase.ts notu.
  app.get('/finance/projects/:id/team-cost-summary', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const items = await calculateTeamCostSummary(id, deps.costRepo);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  // B2 (Day 10): "finance tamamlama" — bkz. calculate-profit-margin.usecase.ts notu.
  app.get('/finance/projects/:id/profit-margin', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const result = await calculateProfitMargin(id, deps.costRepo);
    return ok(result);
  });
}
