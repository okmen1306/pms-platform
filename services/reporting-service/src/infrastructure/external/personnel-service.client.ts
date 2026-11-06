/**
 * B2 (Day 13, "reporting tamamlamaya destek"): B1'in Day 12'de yazdığı `ProjectServiceClient`
 * (work-detail'in `work_package_id`'lerini adlara çözen istemci) work-detail raporunu isimli
 * hale getirmişti, ama `employeeId`'ler HÂLÂ ham UUID'di — hem work-detail'de hem workflow-
 * status'ta (bkz. build-workload-matrix.usecase.ts / build-gantt-view.usecase.ts, Day 12'nin
 * F1 notu: "personel ADLARI henüz çözümlenmediği için ham ID gösterir"). personnel-service'in
 * `GET /employees` (Day 2'den beri var) `ad`/`soyad`'ı HİÇBİR izin kontrolüne tabi tutmadan
 * döner (bkz. list-employees.usecase.ts `toPublicEmployee` — SADECE `maas_tl` maskelenir), bu
 * yüzden reporting-service'in servisler-arası bu çağrısı güvenli.
 */
interface EmployeeSummary {
  id: string;
  ad: string;
  soyad: string;
}

export class PersonnelServiceClient {
  constructor(private readonly baseUrl: string) {}

  /** Tüm aktif+pasif personelin id -> "ad soyad" eşlemesini döner. */
  async resolveEmployeeNames(): Promise<Map<string, string>> {
    const response = await fetch(new URL('/employees', this.baseUrl));
    if (!response.ok) {
      // NOT (ProjectServiceClient'taki AYNI tolerans, bkz. Day 12): personnel-service ANLIK
      // olarak erişilemezse raporlar isim yerine ham UUID ile DEVAM EDER, BAŞARISIZ olmaz.
      return new Map();
    }
    const body = (await response.json()) as { data: EmployeeSummary[] };
    return new Map(body.data.map((e) => [e.id, `${e.ad} ${e.soyad}`]));
  }
}
