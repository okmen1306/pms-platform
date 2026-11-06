import { NotFoundError } from '@pms/shared';

export interface AssignmentSnapshot {
  id: string;
  projectId: string;
  workPackageId: string;
  employeeId: string;
  baslangicTarihi: string;
  bitisTarihi: string;
  tamamlandiMi: boolean;
}

/**
 * notification-service, project-service'in tablosuna ASLA doğrudan dokunmaz (KIRILMAZ KURAL).
 * Gecikme cron'u (delay-check.cron.ts), e-posta göndermeden HEMEN ÖNCE bir atamanın hâlâ
 * "tamamlanmadı" durumunda olup olmadığını bu istemciyle doğrular — böylece personel, uyarı
 * e-postası gönderilmeden az önce görevi tamamlamışsa yanlış alarm verilmez.
 */
export class ProjectServiceClient {
  constructor(private readonly baseUrl: string) {}

  async getAssignment(assignmentId: string): Promise<AssignmentSnapshot> {
    const response = await fetch(new URL(`/assignments/${assignmentId}`, this.baseUrl));
    if (!response.ok) {
      throw new NotFoundError('Personel ataması', assignmentId);
    }
    const body = (await response.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
    const row = body.data;
    return {
      id: row.id,
      projectId: row.project_id,
      workPackageId: row.work_package_id,
      employeeId: row.employee_id,
      baslangicTarihi: row.baslangic_tarihi,
      bitisTarihi: row.bitis_tarihi,
      tamamlandiMi: row.tamamlandi_mi,
    };
  }

  async getProjectTeamLeadId(projectId: string): Promise<string | null> {
    const response = await fetch(new URL(`/projects/${projectId}`, this.baseUrl));
    if (!response.ok) {
      throw new NotFoundError('Proje', projectId);
    }
    const body = (await response.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
    return body.data?.ekip_lideri_id ?? null;
  }

  /**
   * B3 (Day 9): "proje tamamlanma e-postası" — send-project-completed-email.usecase.ts hem
   * ekip liderinin id'sine (mevcut getProjectTeamLeadId ile örtüşüyor ama proje ADINI da
   * istediğinden ayrı bir çağrı yerine BURADA ikisini birden döner) hem de proje adına ihtiyaç
   * duyar (e-posta bağlamı: "X projesi tamamlandı!").
   */
  async getProject(projectId: string): Promise<{ projeAdi: string; ekipLideriId: string }> {
    const response = await fetch(new URL(`/projects/${projectId}`, this.baseUrl));
    if (!response.ok) {
      throw new NotFoundError('Proje', projectId);
    }
    const body = (await response.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
    return { projeAdi: body.data.proje_adi, ekipLideriId: body.data.ekip_lideri_id };
  }

  /**
   * B3 (Day 9): "PROJECT_COMPLETED" e-postası "tüm projede görev almış personele" gider (bkz.
   * docs/roadmap.md "Sipariş/Proje Tamamlanma Saga Akışı" madde 5) — bu, projenin TÜM
   * atamalarındaki BENZERSİZ personel listesi demektir. `GET /projects/:id/assignments`
   * (Day 7'de eklendi, Day 8'in AssignmentsTab'ı zaten kullanıyor) burada YENİDEN kullanılıyor.
   */
  async getProjectEmployeeIds(projectId: string): Promise<string[]> {
    const response = await fetch(new URL(`/projects/${projectId}/assignments`, this.baseUrl));
    if (!response.ok) {
      throw new NotFoundError('Proje atamaları', projectId);
    }
    const body = (await response.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
    const rows = (body.data ?? []) as Array<{ employee_id: string }>;
    return [...new Set(rows.map((r) => r.employee_id))];
  }
}
