import { z } from 'zod';
export const ProjectCreatedEventSchema = z.object({
    projectId: z.guid(),
    startDate: z.string().date(),
    endDate: z.string().date(),
    teamLeadId: z.guid(),
    /**
     * Day 7 eklentisi: finance-service AR-GE maliyeti hesaplarken (bkz. calculate-arge-cost.usecase.ts)
     * integration-service'in `GET /week-ranges?startDate=&totalWeeks=` uç noktasını çağırmak zorunda
     * (Kırılmaz Kural — finance-service project_projects tablosunu bilemez). `totalWeeks` project-service'te
     * zaten hesaplanmış olduğundan (create-project.usecase.ts), event'e eklemek finance-service'in bu
     * değeri YENİDEN hesaplamasını (Kural ihlali) önler. Alan opsiyonel bırakıldı ki bu şemayı zaten
     * tüketen eski consumer'lar (finance/notification, Day 5-6) kırılmasın.
     */
    sureHafta: z.number().int().positive().optional(),
    /**
     * B2 (Day 9): finance-service'in "idari maliyet + kâr marjı hesaplama" işi için gereken proje
     * bazlı girdiler — hepsi `project_projects` tablosunda YÖNETİCİ tarafından proje oluşturulurken
     * girilir (docs/roadmap.md Bölüm 4.4, "SADECE YONETICI" alanları). Kırılmaz Kural gereği
     * finance-service bu tabloya asla doğrudan erişemez; TEK senkronizasyon noktası burasıdır — bu
     * yüzden hepsi burada, TEK SEFERLİK proje oluşturma anında taşınır (henüz bir "proje güncelleme"
     * event'i yok). Hepsi opsiyonel bırakıldı ki bu şemayı zaten tüketen eski consumer'lar
     * (finance/notification, Day 5-6) kırılmasın.
     */
    tahminiMaliyetTl: z.number().optional(),
    satisFiyatiTl: z.number().optional(),
    danismanlikMaliyetiTl: z.number().optional(),
    paketlemeGonderimMaliyetiTl: z.number().optional(),
    idariMaliyetOrani: z.number().optional(),
    /**
     * B3 (Day 10): reporting-service'in `reporting_project_planner_snapshot`i (proje adı NOT
     * NULL) için gerekli — finance'in Day 9'da eklediği alanlarla AYNI mantık, event zaten proje
     * oluşturulurken TEK SEFERLİK yayınlandığından buraya eklemek en basit senkronizasyon yolu.
     */
    projeAdi: z.string().optional(),
});
export const ProjectCompletedEventSchema = z.object({
    projectId: z.guid(),
    completedAt: z.string().datetime(),
});
export const WorkPackagePlannedEventSchema = z.object({
    projectId: z.guid(),
    workPackageId: z.guid(),
    masterWorkPackageId: z.number().int(),
});
export const WorkPackageCompletedEventSchema = z.object({
    projectId: z.guid(),
    workPackageId: z.guid(),
    subWorkPackageId: z.guid().nullable(),
    employeeId: z.guid(),
    onTime: z.boolean(),
});
export const WorkPackageDelayedEventSchema = z.object({
    projectId: z.guid(),
    workPackageId: z.guid(),
    employeeId: z.guid(),
    daysLate: z.number().int().positive(),
});
// RabbitMQ routing key sabitleri — publisher/consumer'lar string literal yazmak yerine bunu import eder
export const PROJECT_EVENTS = {
    CREATED: 'project.created',
    COMPLETED: 'project.completed',
    WORK_PACKAGE_PLANNED: 'work_package.planned',
    WORK_PACKAGE_COMPLETED: 'work_package.completed',
    WORK_PACKAGE_DELAYED: 'work_package.delayed',
};
