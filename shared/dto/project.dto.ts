import { z } from 'zod';

export const ProjectStatusSchema = z.enum([
  'yeni',
  'devam_ediyor',
  'tamamlandi',
  'musteri_talepli_guncelleme',
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  id: z.guid(),
  projeAdi: z.string().min(2),
  baslangicTarihi: z.string().date(),
  bitisTarihi: z.string().date(),
  sureHafta: z.number().int().positive(),
  productGroupId: z.guid(),
  productId: z.guid(),
  durum: ProjectStatusSchema,
  ekipLideriId: z.guid(),
  // Maliyet alanları: sadece finance.cost_analysis izni olanlara döner (bkz. DTO serialization)
  tahminiMaliyetTl: z.number().nullable().optional(),
  satisFiyatiTl: z.number().nullable().optional(),
  danismanlikMaliyetiTl: z.number().default(0),
  paketlemeGonderimMaliyetiTl: z.number().default(0),
  idariMaliyetOrani: z.number().min(0).max(1).default(0),
  createdBy: z.guid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectDtoSchema = z.object({
  projeAdi: z.string().min(2),
  baslangicTarihi: z.string().date(),
  bitisTarihi: z.string().date(),
  productGroupId: z.guid(),
  productId: z.guid(),
  ekipLideriId: z.guid(),
  tahminiMaliyetTl: z.number().positive().optional(),
  satisFiyatiTl: z.number().positive().optional(),
  danismanlikMaliyetiTl: z.number().min(0).default(0),
  paketlemeGonderimMaliyetiTl: z.number().min(0).default(0),
  idariMaliyetOrani: z.number().min(0).max(1).default(0),
}).refine((v) => new Date(v.bitisTarihi) >= new Date(v.baslangicTarihi), {
  message: 'bitisTarihi, baslangicTarihi\'nden önce olamaz',
  path: ['bitisTarihi'],
});
export type CreateProjectDto = z.infer<typeof CreateProjectDtoSchema>;

export const WorkPackageSchema = z.object({
  id: z.guid(),
  projectId: z.guid(),
  masterWorkPackageId: z.number().int(),
  baslangicTarihi: z.string().date().nullable(),
  bitisTarihi: z.string().date().nullable(),
  kalitePuani: z.number().min(0).max(100).nullable(),
});
export type WorkPackage = z.infer<typeof WorkPackageSchema>;

export const SubWorkPackageSchema = z.object({
  id: z.guid(),
  workPackageId: z.guid(),
  ad: z.string().min(1),
  baslangicHafta: z.number().int().positive(),
  bitisHafta: z.number().int().positive(),
  baslangicTarihi: z.string().date().nullable(),
  bitisTarihi: z.string().date().nullable(),
}).refine((v) => v.bitisHafta >= v.baslangicHafta, {
  message: 'bitisHafta, baslangicHafta\'dan küçük olamaz',
  path: ['bitisHafta'],
});
export type SubWorkPackage = z.infer<typeof SubWorkPackageSchema>;

export const TeamWeeklyAllocationDtoSchema = z.object({
  teamId: z.guid(),
  haftaNo: z.number().int().positive(),
  planlananSureHafta: z.number().positive(),
});
export type TeamWeeklyAllocationDto = z.infer<typeof TeamWeeklyAllocationDtoSchema>;

export const MilestoneSchema = z.object({
  id: z.guid(),
  projectId: z.guid(),
  tarih: z.string().date(),
  baslik: z.string().min(1),
  aciklama: z.string().nullable(),
  emailGonderilsin: z.boolean().default(true),
  hedefGruplar: z.array(z.string()).default([]),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

// B1 (Day 9): POST /projects/:id/milestones gövdesi — id/projectId dahil edilmez (projectId
// URL'den gelir, id sunucuda üretilir).
export const CreateMilestoneDtoSchema = z.object({
  tarih: z.string().date(),
  baslik: z.string().min(1),
  aciklama: z.string().optional(),
  emailGonderilsin: z.boolean().default(true),
  hedefGruplar: z.array(z.string()).default([]),
});
export type CreateMilestoneDto = z.infer<typeof CreateMilestoneDtoSchema>;

/**
 * B1 (Day 10): "iş taslağı" (work draft) — bkz. 003_project_tables.sql'deki Day 10 notu (Uzman
 * İnisiyatifi, roadmap'te şema/endpoint tanımı YOK). `boyali` varsayılan `true` — POST hem
 * "boyama" hem "boyayı kaldırma" için kullanılır (boyali:false ile), bu yüzden bir DELETE
 * route'una gerek yok.
 */
export const WorkDraftCellDtoSchema = z.object({
  workPackageId: z.guid(),
  haftaNo: z.number().int().positive(),
  boyali: z.boolean().default(true),
});
export type WorkDraftCellDto = z.infer<typeof WorkDraftCellDtoSchema>;
