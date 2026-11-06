/**
 * B1 (Day 12): "entegrasyon desteği (project tüketicileri)" — reporting-service'in
 * `reporting_workload_snapshot`/`reporting_project_progress` tabloları SADECE `work_package_id`
 * (UUID) tutar, hiçbir isim YOK. project-service'in Day 4-5'ten beri hazır bekleyen İKİ salt
 * okunur uç noktası (`GET /master-work-packages`, `GET /projects/:id/work-packages`) bugüne
 * kadar hiçbir servis tarafından tüketilmemişti — bu istemci, work-detail raporunun (B3)
 * ihtiyacı olan "hangi work_package_id hangi iş paketi adı" eşlemesini kurar.
 */
interface MasterWorkPackage {
  id: number;
  ad: string;
}

interface ProjectWorkPackage {
  id: string;
  master_work_package_id: number;
}

export class ProjectServiceClient {
  constructor(private readonly baseUrl: string) {}

  /** Verilen projedeki work_package_id -> iş paketi adı eşlemesini döner. */
  async resolveWorkPackageNames(projectId: string): Promise<Map<string, string>> {
    const [masterRes, projectRes] = await Promise.all([
      fetch(new URL('/master-work-packages', this.baseUrl)),
      fetch(new URL(`/projects/${projectId}/work-packages`, this.baseUrl)),
    ]);
    if (!masterRes.ok || !projectRes.ok) {
      // NOT: project-service geçici olarak erişilemezse, work-detail raporu isim yerine
      // ham UUID'lerle DEVAM EDER (rapor tamamen başarısız olmaz) — bkz. build-workload-
      // matrix.usecase.ts'teki kullanım.
      return new Map();
    }
    const masterBody = (await masterRes.json()) as { data: MasterWorkPackage[] };
    const projectBody = (await projectRes.json()) as { data: ProjectWorkPackage[] };

    const nameByMasterId = new Map(masterBody.data.map((m) => [m.id, m.ad]));
    const result = new Map<string, string>();
    for (const wp of projectBody.data) {
      const name = nameByMasterId.get(wp.master_work_package_id);
      if (name) result.set(wp.id, name);
    }
    return result;
  }
}
