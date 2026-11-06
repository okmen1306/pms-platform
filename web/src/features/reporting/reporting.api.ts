import { apiFetch } from '../../shared/api';

/**
 * Day 21 (F1, G-05): önceden reporting-service'e DOĞRUDAN (VITE_REPORTING_SERVICE_URL) ve kimliksiz
 * bağlanıyordu. Artık gateway'in `/reporting/*` proxy'sinden geçer (reports.view izni, gateway'de
 * zorlanır). Gateway `/reporting` önekini siler: `/reporting/reports/workflow` -> servis `/reports/workflow`.
 * İş akışı raporu spec adı `/reports/workflow`'a taşındı (eski `workflow-status` alias'ı Day 22'de silinecek).
 * Fonksiyon imzaları DEĞİŞMEDİ.
 */

/**
 * F1 (Day 12): "Reports: WorkflowReportPage + CompletionStatusPage" — B3'ün bugün eklediği
 * `GET /reports/workflow-status` ve `GET /reports/completion-status` (Day 11) uç noktalarının
 * ilk tüketicisi. Diğer sayfalar gibi (RiskRegisterPage, CostAnalysisPage) kalıcı bir navigasyon
 * kabuğu/proje seçici henüz yok — proje ID'si elle girilir.
 */
/**
 * F1 (Day 13 güncellemesi): Day 12'nin notu ("iş paketi/personel adları henüz çözümlenmedi")
 * artık GEÇERSİZ — B1+B2'nin bugünkü "reporting tamamlamaya destek" işiyle backend
 * `workPackageName`/`employeeName` alanlarını da döndürmeye başladı (bkz. reporting-service
 * build-gantt-view.usecase.ts Day 13 notu).
 */
export interface WorkflowStatusEntry {
  workPackageId: string | null;
  workPackageName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  baslangicTarihi: string | null;
  bitisTarihi: string | null;
  tamamlanmaYuzdesi: number;
  durum: 'tamamlandi' | 'devam_ediyor';
}

export async function fetchWorkflowStatus(projectId: string): Promise<WorkflowStatusEntry[]> {
  return apiFetch<WorkflowStatusEntry[]>(`/reporting/reports/workflow?projectId=${projectId}`, { fallbackError: 'İş akışı raporu getirilemedi' });
}

export type CompletionScope = 'project' | 'work-package' | 'employee';

export interface ProjectCompletionSummary {
  scope: 'project';
  projectId: string;
  projeAdi: string;
  tamamlanmaYuzdesi: number;
  tamamlananIsSayisi: number;
  toplamIsSayisi: number;
}

export interface GroupedCompletionEntry {
  key: string;
  tamamlanmaYuzdesi: number;
  tamamlananIsSayisi: number;
  toplamIsSayisi: number;
}

export async function fetchCompletionStatus(
  projectId: string,
  scope: CompletionScope,
): Promise<ProjectCompletionSummary | GroupedCompletionEntry[]> {
  return apiFetch<ProjectCompletionSummary | GroupedCompletionEntry[]>(
    `/reporting/reports/completion-status?projectId=${projectId}&scope=${scope}`,
    { fallbackError: 'Tamamlanma durumu getirilemedi' },
  );
}

/**
 * F1 (Day 13): "Reports: ProjectPlannerPage" — `GET /reports/project-planner`'ın (B3, Day 12;
 * Day 13'te camelCase'e çevrildi, bkz. reporting-service project-planner.controller.ts) ilk
 * tüketicisi. Snapshot bulunamazsa backend 404 döner (proje henüz oluşturulmamış OLABİLİR VEYA
 * `project.created` event'i henüz İŞLENMEMİŞ olabilir — bu iki durum frontend'den AYIRT
 * edilemez, bkz. sayfadaki not).
 */
export interface ProjectPlannerSnapshot {
  projectId: string;
  projeAdi: string;
  planlananBaslangic: string | null;
  planlananSureHafta: number | null;
  fiiliBaslangic: string | null;
  fiiliSureHafta: number | null;
  tamamlanmaYuzdesi: number | null;
  guncelleme: string;
}

export async function fetchProjectPlanner(projectId: string): Promise<ProjectPlannerSnapshot> {
  return apiFetch<ProjectPlannerSnapshot>(`/reporting/reports/project-planner?projectId=${projectId}`, {
    fallbackError: 'Proje planlayıcı verisi getirilemedi',
  });
}

/**
 * F1 (Day 13): "Reports: WorkDetailPage" — `GET /reports/work-detail`'in (B3, Day 12; B1+B2'nin
 * Day 13'teki isim çözümü desteğiyle) ilk tüketicisi. Her girdi bir iş paketini, `haftalar` ise
 * o iş paketinde çalışan personelin hangi haftalarda göründüğünü temsil eder (bkz.
 * build-workload-matrix.usecase.ts).
 */
export interface WorkDetailEntry {
  workPackageId: string;
  workPackageName: string | null;
  haftalar: { employeeId: string; employeeName: string | null; haftaNo: number }[];
}

export async function fetchWorkDetail(projectId: string): Promise<WorkDetailEntry[]> {
  return apiFetch<WorkDetailEntry[]>(`/reporting/reports/work-detail?projectId=${projectId}`, { fallbackError: 'İş detay raporu getirilemedi' });
}
