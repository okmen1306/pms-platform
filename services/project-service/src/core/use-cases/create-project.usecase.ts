import { NotFoundError, ValidationError, type AuditPublisherFn } from '@pms/shared';
import type { ProjectRepository, ProjectRow } from '../../infrastructure/database/project.repository';
import type { ProductCatalogRepository } from '../../infrastructure/database/product-catalog.repository';
import type { IntegrationServiceClient } from '../../infrastructure/external/integration-service.client';
import { calculateProjectDurationWeeks } from './calculate-project-duration.usecase';

export interface CreateProjectInput {
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

/**
 * Kural (docs/roadmap.md "Proje Planlama" bölümü): proje süresi (hafta) OTOMATIK hesaplanır,
 * kullanıcı girmez (Excel prototipindeki "sarı hücre" mantığı — sadece başlangıç/bitiş tarihi
 * girilir). Ürün, seçilen ürün grubuna ait olmalı (madde 1: ürünler gruplarla ilişkilendirilir).
 */
export async function createProject(
  input: CreateProjectInput,
  actorUserId: string,
  projectRepo: ProjectRepository,
  catalogRepo: ProductCatalogRepository,
  integrationClient: IntegrationServiceClient,
  publishAudit: AuditPublisherFn,
  publishProjectCreated: (event: {
    projectId: string;
    startDate: string;
    endDate: string;
    teamLeadId: string;
    sureHafta: number;
    tahminiMaliyetTl?: number;
    satisFiyatiTl?: number;
    danismanlikMaliyetiTl?: number;
    paketlemeGonderimMaliyetiTl?: number;
    idariMaliyetOrani?: number;
    projeAdi?: string;
  }) => Promise<void>,
): Promise<ProjectRow> {
  if (new Date(input.bitisTarihi) < new Date(input.baslangicTarihi)) {
    throw new ValidationError('bitisTarihi, baslangicTarihi\'nden önce olamaz');
  }

  const products = await catalogRepo.listProducts(input.productGroupId);
  const product = products.find((p) => p.id === input.productId);
  if (!product) {
    throw new NotFoundError('Ürün (seçilen ürün grubunda)', input.productId);
  }

  const sureHafta = await calculateProjectDurationWeeks(
    input.baslangicTarihi,
    input.bitisTarihi,
    integrationClient,
  );

  const created = await projectRepo.create({
    proje_adi: input.projeAdi,
    baslangic_tarihi: input.baslangicTarihi,
    bitis_tarihi: input.bitisTarihi,
    sure_hafta: sureHafta,
    product_group_id: input.productGroupId,
    product_id: input.productId,
    ekip_lideri_id: input.ekipLideriId,
    tahmini_maliyet_tl: input.tahminiMaliyetTl,
    satis_fiyati_tl: input.satisFiyatiTl,
    danismanlik_maliyeti_tl: input.danismanlikMaliyetiTl ?? 0,
    paketleme_gonderim_maliyeti_tl: input.paketlemeGonderimMaliyetiTl ?? 0,
    idari_maliyet_orani: input.idariMaliyetOrani ?? 0,
    created_by: actorUserId,
  });

  await publishProjectCreated({
    projectId: created.id,
    startDate: created.baslangic_tarihi,
    endDate: created.bitis_tarihi,
    teamLeadId: created.ekip_lideri_id,
    sureHafta: created.sure_hafta,
    // B2 (Day 9): finance-service'in idari maliyet + kâr marjı hesabı için (bkz.
    // shared/events/project.events.ts ProjectCreatedEventSchema Day 9 notu).
    tahminiMaliyetTl: created.tahmini_maliyet_tl ?? undefined,
    satisFiyatiTl: created.satis_fiyati_tl ?? undefined,
    danismanlikMaliyetiTl: created.danismanlik_maliyeti_tl,
    paketlemeGonderimMaliyetiTl: created.paketleme_gonderim_maliyeti_tl,
    idariMaliyetOrani: created.idari_maliyet_orani,
    // B3 (Day 10): reporting-service'in project-created.consumer.ts'i için (bkz. shared/events/
    // project.events.ts Day 10 notu).
    projeAdi: created.proje_adi,
  });

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'project_projects',
    entityId: created.id,
    ozet: `"${created.proje_adi}" projesi oluşturuldu (${created.sure_hafta} hafta).`,
    severity: 'info',
  });

  return created;
}
