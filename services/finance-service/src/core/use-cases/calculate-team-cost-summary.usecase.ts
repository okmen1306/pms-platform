import type { CostRepository } from '../../infrastructure/database/cost.repository';

export interface TeamCostSummaryWeek {
  haftaNo: number;
  haftaBaslangicTarihi: string;
  toplamMaliyetTl: number;
  toplamMaliyetUsd: number;
  calisanSayisi: number;
}

/**
 * B2 (Day 10): "finance tamamlama". `GET /finance/projects/:id/team-cost-summary` roadmap'in
 * uç nokta listesinde planlıydı ama hiç eklenmemişti. `/personnel-weekly-cost` (Day 7) HER
 * ÇALIŞAN için AYRI bir satır döner — bu, aynı veriyi hafta bazında TOPLAYIP (kaç kişi, toplam
 * maliyet) "ekibin bu hafta toplam maliyeti neydi" sorusuna cevap verir (Bölüm 8'in isimlendirmesi
 * "team-cost-summary" — proje bazında TEK bir ekip var sayılıyor, roadmap'te birden fazla ekip/
 * proje ayrımı yok, bkz. Kural #10'un "aynı hafta birden fazla PROJE" bölme mantığı da proje
 * bazlı, ekip bazlı değil).
 */
export async function calculateTeamCostSummary(projectId: string, costRepo: CostRepository): Promise<TeamCostSummaryWeek[]> {
  const rows = await costRepo.listWeeklyCostsByProject(projectId);

  const byWeek = new Map<number, { haftaBaslangicTarihi: string; tl: number; usd: number; employeeIds: Set<string> }>();
  for (const row of rows) {
    const existing = byWeek.get(row.hafta_no) ?? {
      haftaBaslangicTarihi: row.hafta_baslangic_tarihi,
      tl: 0,
      usd: 0,
      employeeIds: new Set<string>(),
    };
    existing.tl += Number(row.haftalik_maliyet_tl);
    existing.usd += Number(row.haftalik_maliyet_usd);
    existing.employeeIds.add(row.employee_id);
    byWeek.set(row.hafta_no, existing);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([haftaNo, w]) => ({
      haftaNo,
      haftaBaslangicTarihi: w.haftaBaslangicTarihi,
      toplamMaliyetTl: w.tl,
      toplamMaliyetUsd: w.usd,
      calisanSayisi: w.employeeIds.size,
    }));
}
