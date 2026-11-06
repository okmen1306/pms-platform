import { NotFoundError, ValidationError, WeeklyCapacityExceededError, type AuditPublisherFn } from '@pms/shared';
import type { ProjectRepository, ProjectRow, CreateProjectRow } from '../../infrastructure/database/project.repository';
import type { WeeklyAllocationRepository } from '../../infrastructure/database/weekly-allocation.repository';
import type { IntegrationServiceClient } from '../../infrastructure/external/integration-service.client';
import { calculateProjectDurationWeeks } from './calculate-project-duration.usecase';

export interface UpdateProjectInput {
  projeAdi?: string;
  baslangicTarihi?: string;
  bitisTarihi?: string;
  ekipLideriId?: string;
  tahminiMaliyetTl?: number;
  satisFiyatiTl?: number;
  danismanlikMaliyetiTl?: number;
  paketlemeGonderimMaliyetiTl?: number;
  idariMaliyetOrani?: number;
}

/**
 * Day 20 (roadmap Bölüm 8: `PATCH /projects/:id`). Kurallar:
 *  - Tarih değişirse `sure_hafta` YENİDEN hesaplanır (Kural #3 — tatiller integration-service'ten).
 *  - Kural #7: yeni süre, bir ekibin mevcut haftalık planlama toplamının ALTINA düşemez; aksi halde
 *    409 WEEKLY_CAPACITY_EXCEEDED (süre kısaltılırken planlama sessizce geçersiz kalmaz).
 *  - Ürün grubu/ürün bu endpoint'ten DEĞİŞTİRİLEMEZ: planlanmış iş paketleri ve maliyet ürüne bağlı.
 *
 * BİLİNEN SINIR (Day 22 / G-14): finance, reporting ve notification proje alanlarını `project.created`
 * anında anlık görüntü olarak saklıyor ve henüz bir `project.updated` event'i yok — bu endpoint
 * project-service'teki kaydı günceller, o anlık görüntüler Day 22'ye kadar eski kalır.
 */
export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  actorUserId: string,
  projectRepo: ProjectRepository,
  allocationRepo: WeeklyAllocationRepository,
  integrationClient: IntegrationServiceClient,
  publishAudit: AuditPublisherFn,
): Promise<ProjectRow> {
  const changedKeys = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
  if (changedKeys.length === 0) {
    throw new ValidationError('Güncellenecek en az bir alan gönderilmeli');
  }

  const existing = await projectRepo.findById(projectId);
  if (!existing) throw new NotFoundError('Proje', projectId);

  const patch: Partial<CreateProjectRow> = {};
  if (input.projeAdi !== undefined) patch.proje_adi = input.projeAdi;
  if (input.ekipLideriId !== undefined) patch.ekip_lideri_id = input.ekipLideriId;
  if (input.tahminiMaliyetTl !== undefined) patch.tahmini_maliyet_tl = input.tahminiMaliyetTl;
  if (input.satisFiyatiTl !== undefined) patch.satis_fiyati_tl = input.satisFiyatiTl;
  if (input.danismanlikMaliyetiTl !== undefined) patch.danismanlik_maliyeti_tl = input.danismanlikMaliyetiTl;
  if (input.paketlemeGonderimMaliyetiTl !== undefined) patch.paketleme_gonderim_maliyeti_tl = input.paketlemeGonderimMaliyetiTl;
  if (input.idariMaliyetOrani !== undefined) patch.idari_maliyet_orani = input.idariMaliyetOrani;

  if (input.baslangicTarihi !== undefined || input.bitisTarihi !== undefined) {
    const start = input.baslangicTarihi ?? existing.baslangic_tarihi;
    const end = input.bitisTarihi ?? existing.bitis_tarihi;
    if (new Date(end) < new Date(start)) {
      throw new ValidationError("bitisTarihi, baslangicTarihi'nden önce olamaz");
    }
    const sureHafta = await calculateProjectDurationWeeks(start, end, integrationClient);

    const perTeam = new Map<string, number>();
    for (const row of await allocationRepo.listByProject(projectId)) {
      perTeam.set(row.team_id, (perTeam.get(row.team_id) ?? 0) + Number(row.planlanan_sure_hafta));
    }
    for (const [teamId, total] of perTeam) {
      if (total > sureHafta) throw new WeeklyCapacityExceededError(teamId, projectId);
    }

    patch.baslangic_tarihi = start;
    patch.bitis_tarihi = end;
    patch.sure_hafta = sureHafta;
  }

  const updated = await projectRepo.update(projectId, patch);

  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'project_projects',
    entityId: projectId,
    ozet: `"${updated.proje_adi}" projesi güncellendi (${changedKeys.join(', ')}).`,
    severity: 'info',
  });

  return updated;
}
