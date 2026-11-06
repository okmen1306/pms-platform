import { apiFetch } from '../../shared/api';

/**
 * Day 19 (Entegrasyon Haftası): Day 6'dan beri project-service'e DOĞRUDAN (3003) ve kimlik
 * bilgisiz bağlanıyordu ("api-gateway hazır olana kadar geçici doğrudan bağlantı"). Artık her
 * çağrı gateway'in `/project/*` proxy'sinden geçiyor (bkz. api-gateway/src/routes/project.routes.ts —
 * `authenticate` + `x-actor-id` enjeksiyonu); `Authorization: Bearer`, `{success,data,error}` zarfının
 * açılması ve hata normalizasyonu shared/api/apiClient.ts'te. Dışa açık fonksiyon imzaları DEĞİŞMEDİ
 * (çağıran sekmeler dokunulmadan çalışmaya devam ediyor) — TEK fark: hatalar artık `ApiError`
 * (status + code + details), böylece UI 409 ASSIGNMENT_CONFLICT / WEEKLY_CAPACITY_EXCEEDED gibi
 * iş kurallarını koda göre ayırabilir (bkz. `describeProjectError`).
 */

export interface ProjectDetail {
  id: string;
  proje_adi: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  sure_hafta: number;
  durum: string;
  ekip_lideri_id: string;
  product_group_id: string;
  product_id: string;
  tahmini_maliyet_tl: number | null;
  satis_fiyati_tl: number | null;
  danismanlik_maliyeti_tl: number;
  paketleme_gonderim_maliyeti_tl: number;
  idari_maliyet_orani: number;
}

export interface MasterWorkPackage {
  id: number;
  sira_no: number;
  ad: string;
  ust_id: number | null;
}

export interface WorkPackage {
  id: string;
  project_id: string;
  master_work_package_id: number;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
}

export async function fetchProject(id: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/project/projects/${id}`, { fallbackError: 'Proje alınamadı' });
}

export async function fetchMasterWorkPackages(): Promise<MasterWorkPackage[]> {
  return apiFetch<MasterWorkPackage[]>('/project/master-work-packages', { fallbackError: 'Üst iş paketleri alınamadı' });
}

export async function fetchProjectWorkPackages(projectId: string): Promise<WorkPackage[]> {
  return apiFetch<WorkPackage[]>(`/project/projects/${projectId}/work-packages`, { fallbackError: 'İş paketleri alınamadı' });
}

export interface WeeklyAllocation {
  id: string;
  project_id: string;
  team_id: string;
  hafta_no: number;
  planlanan_sure_hafta: number;
}

export async function fetchWeeklyAllocations(projectId: string): Promise<WeeklyAllocation[]> {
  return apiFetch<WeeklyAllocation[]>(`/project/projects/${projectId}/weekly-allocation`, {
    fallbackError: 'Haftalık planlama alınamadı',
  });
}

export async function createWeeklyAllocation(
  projectId: string,
  teamId: string,
  haftaNo: number,
  planlananSureHafta: number,
): Promise<WeeklyAllocation> {
  return apiFetch<WeeklyAllocation>(`/project/projects/${projectId}/weekly-allocation`, {
    method: 'POST',
    body: { teamId, haftaNo, planlananSureHafta },
    fallbackError: 'Haftalık planlama kaydedilemedi',
  });
}

// Q (Day 8 — tam derleme taraması, bkz. CHANGELOG.md): `export async function planWorkPackage(`
// bildirim satırı bir ara EKSİKTİ (web paketi HİÇ tsc ile derlenmediği için fark edilmemişti).
export async function planWorkPackage(
  projectId: string,
  masterWorkPackageId: number,
  baslangicTarihi?: string,
  bitisTarihi?: string,
): Promise<WorkPackage> {
  return apiFetch<WorkPackage>(`/project/projects/${projectId}/work-packages`, {
    method: 'POST',
    body: { masterWorkPackageId, baslangicTarihi, bitisTarihi },
    fallbackError: 'İş paketi planlanamadı',
  });
}

/**
 * F1 (Day 8): `Assignment`, backend'in shared `AssignmentSchema`'sını (camelCase) DEĞİL —
 * assignment.controller.ts'in GERÇEKTE döndürdüğü ham DB satırını (snake_case, bkz.
 * assignment.repository.ts AssignmentRow) modeller. Day 19'da gerçek API'ye karşı doğrulandı
 * (bkz. tests/integration/README.md): yanıt tam olarak bu şekilde.
 */
export interface Assignment {
  id: string;
  project_id: string;
  work_package_id: string;
  sub_work_package_id: string | null;
  employee_id: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  tamamlandi_mi: boolean;
  tamamlanma_tarihi: string | null;
  created_at: string;
}

export async function fetchAssignments(projectId: string): Promise<Assignment[]> {
  return apiFetch<Assignment[]>(`/project/projects/${projectId}/assignments`, { fallbackError: 'Atamalar alınamadı' });
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingAssignments: Assignment[];
}

/**
 * F1 (Day 8): B1'in `GET .../assignments/conflict-check` uç noktası — GÖNDER'e basmadan ÖNCE
 * kullanıcıyı uyarmak için (bkz. check-assignment-conflict.usecase.ts). Asıl garanti hâlâ
 * backend'de (DB'nin `EXCLUDE USING gist` kısıtlaması, createAssignment 409 döndürebilir) —
 * bu SADECE bir kullanıcı deneyimi katmanı.
 */
export async function checkAssignmentConflict(
  projectId: string,
  employeeId: string,
  baslangicTarihi: string,
  bitisTarihi: string,
): Promise<ConflictCheckResult> {
  const query = new URLSearchParams({ employeeId, baslangicTarihi, bitisTarihi }).toString();
  return apiFetch<ConflictCheckResult>(`/project/projects/${projectId}/assignments/conflict-check?${query}`, {
    fallbackError: 'Çakışma kontrolü yapılamadı',
  });
}

export async function createAssignment(
  projectId: string,
  workPackageId: string,
  employeeId: string,
  baslangicTarihi: string,
  bitisTarihi: string,
): Promise<Assignment> {
  // Kural: backend'in 409 ASSIGNMENT_CONFLICT'i (bkz. assign-personnel.usecase.ts, DB EXCLUDE
  // kısıtlaması) KESİN doğruluk kaynağıdır — conflict-check UI uyarısını görüp GÖNDER'e basılsa
  // bile buradan geçilemez. Hata `ApiError` olarak (code + details ile) fırlatılır.
  return apiFetch<Assignment>(`/project/projects/${projectId}/assignments`, {
    method: 'POST',
    body: { workPackageId, employeeId, baslangicTarihi, bitisTarihi },
    fallbackError: 'Atama kaydedilemedi',
  });
}

/**
 * F1 (Day 9): `project_milestones` — Assignment ile AYNI durum: backend ham DB satırını
 * (snake_case) döner, shared'daki camelCase `MilestoneSchema`'yı DEĞİL.
 */
export interface Milestone {
  id: string;
  project_id: string;
  tarih: string;
  baslik: string;
  aciklama: string | null;
  email_gonderilsin: boolean;
  hedef_gruplar: string[];
  created_by: string;
  created_at: string;
}

export async function fetchMilestones(projectId: string): Promise<Milestone[]> {
  return apiFetch<Milestone[]>(`/project/projects/${projectId}/milestones`, { fallbackError: 'Zaman çizelgesi alınamadı' });
}

export async function createMilestone(
  projectId: string,
  tarih: string,
  baslik: string,
  aciklama?: string,
): Promise<Milestone> {
  return apiFetch<Milestone>(`/project/projects/${projectId}/milestones`, {
    method: 'POST',
    body: { tarih, baslik, aciklama, emailGonderilsin: true, hedefGruplar: [] },
    fallbackError: 'Kilometre taşı kaydedilemedi',
  });
}

/**
 * F1 (Day 10): "iş taslağı" (work draft) — bkz. backend'deki Uzman İnisiyatifi notu
 * (003_project_tables.sql). Basit bir hücre: proje × iş paketi × hafta = boyalı mı?
 */
export interface WorkDraftCell {
  id: string;
  project_id: string;
  work_package_id: string;
  hafta_no: number;
  boyali: boolean;
  created_by: string;
  created_at: string;
}

export async function fetchWorkDraft(projectId: string): Promise<WorkDraftCell[]> {
  return apiFetch<WorkDraftCell[]>(`/project/projects/${projectId}/work-draft`, { fallbackError: 'İş taslağı alınamadı' });
}

export async function setWorkDraftCell(
  projectId: string,
  workPackageId: string,
  haftaNo: number,
  boyali: boolean,
): Promise<WorkDraftCell> {
  return apiFetch<WorkDraftCell>(`/project/projects/${projectId}/work-draft`, {
    method: 'POST',
    body: { workPackageId, haftaNo, boyali },
    fallbackError: 'Hücre kaydedilemedi',
  });
}

// ---------------------------------------------------------------------------------------------
// Day 20: proje listesi / oluşturma / düzenleme, katalog, iş günü önizlemesi, atama tamamlama,
// alt iş paketi CRUD. Hepsi gateway `/project/*` (ve `/integration/*`) üzerinden.
// ---------------------------------------------------------------------------------------------

export async function fetchProjects(filters: { durum?: string; ekipLideriId?: string } = {}): Promise<ProjectDetail[]> {
  const params = new URLSearchParams();
  if (filters.durum) params.set('durum', filters.durum);
  if (filters.ekipLideriId) params.set('ekipLideriId', filters.ekipLideriId);
  const query = params.toString();
  return apiFetch<ProjectDetail[]>(`/project/projects${query ? `?${query}` : ''}`, { fallbackError: 'Projeler alınamadı' });
}

export interface ProjectInput {
  projeAdi: string;
  baslangicTarihi: string;
  bitisTarihi: string;
  productGroupId: string;
  productId: string;
  ekipLideriId: string;
  tahminiMaliyetTl?: number;
  satisFiyatiTl?: number;
  danismanlikMaliyetiTl?: number;
  paketlemeGonderimMaliyetiTl?: number;
  idariMaliyetOrani?: number;
}

export async function createProject(input: ProjectInput): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>('/project/projects', { method: 'POST', body: input, fallbackError: 'Proje oluşturulamadı' });
}

/** Ürün grubu/ürün düzenlemeye KAPALI (bkz. update-project.usecase.ts) — bu yüzden `Partial<ProjectInput>` değil. */
export type ProjectPatch = Partial<Omit<ProjectInput, 'productGroupId' | 'productId'>>;

export async function updateProject(id: string, patch: ProjectPatch): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/project/projects/${id}`, { method: 'PATCH', body: patch, fallbackError: 'Proje güncellenemedi' });
}

export interface ProductGroup {
  id: string;
  ad: string;
}
export interface Product {
  id: string;
  ad: string;
  product_group_id: string;
}

export async function fetchProductGroups(): Promise<ProductGroup[]> {
  return apiFetch<ProductGroup[]>('/project/product-groups', { fallbackError: 'Ürün grupları alınamadı' });
}

export async function fetchProducts(groupId: string): Promise<Product[]> {
  const query = new URLSearchParams({ groupId }).toString();
  return apiFetch<Product[]>(`/project/products?${query}`, { fallbackError: 'Ürünler alınamadı' });
}

export interface BusinessDays {
  totalBusinessDays: number;
}

/** Kural #3: sihirbazdaki süre ÖNİZLEMESİ — resmî tatiller düşülmüş iş günü (tek doğru kaynak integration-service). */
export async function fetchBusinessDays(start: string, end: string): Promise<BusinessDays> {
  const query = new URLSearchParams({ start, end }).toString();
  return apiFetch<BusinessDays>(`/integration/business-days?${query}`, { fallbackError: 'İş günü hesaplanamadı' });
}

export async function completeAssignment(assignmentId: string): Promise<Assignment> {
  return apiFetch<Assignment>(`/project/assignments/${assignmentId}/complete`, {
    method: 'PATCH',
    body: {},
    fallbackError: 'Atama tamamlanamadı',
  });
}

export interface SubWorkPackage {
  id: string;
  work_package_id: string;
  ad: string;
  baslangic_hafta: number;
  bitis_hafta: number;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  created_by: string;
}

export async function fetchSubWorkPackages(workPackageId: string): Promise<SubWorkPackage[]> {
  return apiFetch<SubWorkPackage[]>(`/project/work-packages/${workPackageId}/sub-work-packages`, {
    fallbackError: 'Alt iş paketleri alınamadı',
  });
}

export interface SubWorkPackageInput {
  ad: string;
  baslangicHafta: number;
  bitisHafta: number;
}

export async function addSubWorkPackage(workPackageId: string, input: SubWorkPackageInput): Promise<SubWorkPackage> {
  return apiFetch<SubWorkPackage>(`/project/work-packages/${workPackageId}/sub-work-packages`, {
    method: 'POST',
    body: input,
    fallbackError: 'Alt iş paketi eklenemedi',
  });
}

export async function updateSubWorkPackage(id: string, patch: Partial<SubWorkPackageInput>): Promise<SubWorkPackage> {
  return apiFetch<SubWorkPackage>(`/project/sub-work-packages/${id}`, {
    method: 'PATCH',
    body: patch,
    fallbackError: 'Alt iş paketi güncellenemedi',
  });
}

export async function deleteSubWorkPackage(id: string): Promise<void> {
  await apiFetch<unknown>(`/project/sub-work-packages/${id}`, { method: 'DELETE', fallbackError: 'Alt iş paketi silinemedi' });
}
