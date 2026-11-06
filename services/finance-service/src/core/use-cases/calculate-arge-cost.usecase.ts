import { tlToUsd } from '@pms/shared';
import type { CostRepository } from '../../infrastructure/database/cost.repository';
import type {
  AssignmentCacheRepository,
  CachedAssignmentRow,
} from '../../infrastructure/database/assignment-cache.repository';
import type { IntegrationServiceClient } from '../../infrastructure/external/integration-service.client';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';

/** İki tarih aralığı çakışıyor mu (ikisi de dahil sınır — '[]' daterange semantiği). */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

/**
 * Kural #10 (docs/roadmap.md): "Bir personel aynı hafta birden fazla projede görevliyse, o
 * haftaki maliyeti proje sayısına bölünür." Bu use-case, `assignment.created` event'i her
 * geldiğinde (bkz. assignment-created.consumer.ts) SADECE o event'in projesi için haftalık
 * maliyeti (yeniden) hesaplar.
 *
 * BİLİNÇLİ KAPSAM SINIRI (Uzman İnisiyatifi, over-engineering'den kaçınmak için): eğer bu yeni
 * atama, personelin AYNI takvim haftasında zaten çalıştığı BAŞKA bir projeyi de etkiliyorsa
 * (bölme oranı N değiştiği için o projenin de satırı teorik olarak güncellenmeli), bu use-case
 * SADECE mevcut projeyi günceller — diğer projenin satırı, o proje için yeni bir `assignment.created`
 * gelene kadar bir önceki (daha düşük N'li) haliyle kalır. Bu, günlük teslim döngüsüne göre kabul
 * edilebilir bir sınırlama; tam geriye dönük çapraz-proje yeniden hesaplama (bkz. TODO) ileri bir
 * güne bırakıldı.
 *
 * "Aynı hafta" burada TAKVİM tarih aralığı çakışması olarak tanımlanır (iki projenin
 * hafta_no'ları farklı başlangıç tarihlerinden dolayı hizalı olmayabilir) — her projenin kendi
 * hafta_no'su yine de integration-service'ten (`GET /week-ranges`) alınır ki
 * `finance_personnel_weekly_cost.hafta_no` proje bağlamında anlamlı kalsın.
 *
 * NOT (haftalık maliyet formülü): roadmap.md aylık maaştan haftalık maliyete çevrim formülünü
 * belirtmiyor. `maas_tl * 12 / 52` (yıllıklandırıp 52 haftaya bölme) kullanıldı — "/4.33" gibi
 * yaklaşık bir ay-haftası oranından daha kesin ve ay uzunluğundan bağımsız (Uzman İnisiyatifi).
 */
export async function calculateArgeCostForAssignment(
  assignment: { assignmentId: string; projectId: string; employeeId: string; start: string; end: string },
  assignmentCacheRepo: AssignmentCacheRepository,
  costRepo: CostRepository,
  integrationClient: IntegrationServiceClient,
  personnelClient: PersonnelServiceClient,
  logger: { warn: (msg: string) => void },
): Promise<void> {
  await assignmentCacheRepo.upsertAssignment({
    assignment_id: assignment.assignmentId,
    project_id: assignment.projectId,
    employee_id: assignment.employeeId,
    baslangic_tarihi: assignment.start,
    bitis_tarihi: assignment.end,
  });

  const meta = await assignmentCacheRepo.findProjectMeta(assignment.projectId);
  if (!meta) {
    // project.created event henüz işlenmemiş olabilir (yarış durumu) — bu, pratikte olmamalı
    // çünkü bir projeye atama yapılabilmesi için proje zaten UI'da var olmalı, ama savunmacı
    // programlama gereği sessizce atlanır (bir sonraki atama event'inde tekrar denenecek değil,
    // TODO: Day 9+'da bir "recompute" endpoint'i eklenebilir).
    logger.warn(`finance-service: proje meta önbelleği yok (${assignment.projectId}), AR-GE maliyeti atlandı.`);
    return;
  }

  const [weekRanges, salary, usdTryRate, employeeAssignments] = await Promise.all([
    integrationClient.getWeekRanges(meta.baslangic_tarihi, meta.sure_hafta),
    personnelClient.getEmployeeSalary(assignment.employeeId),
    integrationClient.getCurrentUsdTryRate(),
    assignmentCacheRepo.findByEmployee(assignment.employeeId),
  ]);

  const weeklyBaseTl = (salary.maasTl * 12) / 52;

  const overlappingWeeks = weekRanges.filter((w) => overlaps(w.startDate, w.endDate, assignment.start, assignment.end));

  for (const week of overlappingWeeks) {
    const projectsThisWeek = new Set<string>(
      employeeAssignments
        .filter((a: CachedAssignmentRow) => overlaps(a.baslangic_tarihi, a.bitis_tarihi, week.startDate, week.endDate))
        .map((a) => a.project_id),
    );
    projectsThisWeek.add(assignment.projectId); // yeni atama henüz cache'te olabilir (upsert az önce yapıldı, olmalı ama garanti)

    const ayniHaftaProjeSayisi = projectsThisWeek.size;
    const haftalikMaliyetTl = Math.round((weeklyBaseTl / ayniHaftaProjeSayisi) * 100) / 100;
    const haftalikMaliyetUsd = tlToUsd(haftalikMaliyetTl, usdTryRate);

    await costRepo.upsertWeeklyCost({
      project_id: assignment.projectId,
      employee_id: assignment.employeeId,
      hafta_no: week.weekNo,
      hafta_baslangic_tarihi: week.startDate,
      haftalik_maliyet_tl: haftalikMaliyetTl,
      haftalik_maliyet_usd: haftalikMaliyetUsd,
      ayni_hafta_proje_sayisi: ayniHaftaProjeSayisi,
    });
  }

  if (overlappingWeeks.length > 0) {
    await costRepo.recalculateCostRollup(assignment.projectId);
  }
}
