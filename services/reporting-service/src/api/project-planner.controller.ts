import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, NotFoundError } from '@pms/shared';
import type { ReportRepository } from '../infrastructure/database/report.repository';

const QuerySchema = z.object({ projectId: z.guid() });

/**
 * B3 (Day 12) + Day 13 düzeltmesi: "project-planner.controller.ts" — roadmap dosya ağacında
 * ayrı bir use-case PLANLANMAMIŞ (audit-log.controller.ts (Day 11) ile AYNI "saf okuma" deseni):
 * sadece `findPlannerSnapshot`'ı (Day 10'dan beri var, hiç HTTP'ye açılmamıştı) dışa açar.
 * Day 13 (B3, "reporting-service tamamlama"): Day 12'de bu uç nokta `ProjectPlannerSnapshotRow`'u
 * OLDUĞU GİBİ (ham snake_case: `proje_adi`, `planlanan_baslangic`...) dönüyordu — reporting-
 * service'in DİĞER TÜM uç noktalarından (workflow-status, completion-status, work-detail)
 * FARKLI olarak, hepsi camelCase döner. F1'in bugün ProjectPlannerPage'i yazarken fark ettiği
 * gerçek bir tutarsızlıktı — burada düzeltildi, frontend'in bunu SESSİZCE normalize etmesine
 * gerek KALMADI.
 */
export function registerProjectPlannerRoutes(app: FastifyInstance, deps: { reportRepo: ReportRepository }) {
  app.get('/reports/project-planner', async (request) => {
    const { projectId } = QuerySchema.parse(request.query);
    const snapshot = await deps.reportRepo.findPlannerSnapshot(projectId);
    if (!snapshot) throw new NotFoundError('Proje planlayıcı snapshot\'ı', projectId);
    return ok({
      projectId: snapshot.project_id,
      projeAdi: snapshot.proje_adi,
      planlananBaslangic: snapshot.planlanan_baslangic,
      planlananSureHafta: snapshot.planlanan_sure_hafta,
      fiiliBaslangic: snapshot.fiili_baslangic,
      fiiliSureHafta: snapshot.fiili_sure_hafta,
      tamamlanmaYuzdesi: snapshot.tamamlanma_yuzdesi,
      guncelleme: snapshot.guncelleme,
    });
  });
}
