import { z } from 'zod';

export const AssignmentSchema = z.object({
  id: z.guid(),
  projectId: z.guid(),
  workPackageId: z.guid(),
  subWorkPackageId: z.guid().nullable(),
  employeeId: z.guid(),
  baslangicTarihi: z.string().date(),
  bitisTarihi: z.string().date(),
  tamamlandiMi: z.boolean().default(false),
  tamamlanmaTarihi: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Assignment = z.infer<typeof AssignmentSchema>;

export const CreateAssignmentDtoSchema = z
  .object({
    workPackageId: z.guid(),
    subWorkPackageId: z.guid().optional(),
    employeeId: z.guid(),
    baslangicTarihi: z.string().date(),
    bitisTarihi: z.string().date(),
  })
  .refine((v) => new Date(v.bitisTarihi) >= new Date(v.baslangicTarihi), {
    message: 'bitisTarihi, baslangicTarihi\'nden önce olamaz',
    path: ['bitisTarihi'],
  });
export type CreateAssignmentDto = z.infer<typeof CreateAssignmentDtoSchema>;

// project-service, 409 ASSIGNMENT_CONFLICT dönerken bu şekli kullanır (bkz. shared/errors)
export const AssignmentConflictDetailSchema = z.object({
  employeeId: z.guid(),
  conflictingAssignmentIds: z.array(z.guid()),
});
export type AssignmentConflictDetail = z.infer<typeof AssignmentConflictDetailSchema>;

export const MarkAssignmentCompleteDtoSchema = z.object({
  tamamlanmaTarihi: z.string().datetime().optional(), // verilmezse server NOW() kullanır
});
export type MarkAssignmentCompleteDto = z.infer<typeof MarkAssignmentCompleteDtoSchema>;

// B1 (Day 8): "çakışma uyarı endpoint'i" — GET /projects/:id/assignments/conflict-check
// query string'i. Gateway'den geçen her şey string olduğundan zod query şeması burada
// CreateAssignmentDtoSchema'dan AYRI tutuldu (örn. excludeAssignmentId opsiyonel ve
// projectId query'de YOK — çakışma personel bazlı, projeler arası kontrol edilir, bkz.
// assignment.repository.ts findOverlapping).
export const AssignmentConflictCheckQuerySchema = z.object({
  employeeId: z.guid(),
  baslangicTarihi: z.string().date(),
  bitisTarihi: z.string().date(),
  excludeAssignmentId: z.guid().optional(),
});
export type AssignmentConflictCheckQuery = z.infer<typeof AssignmentConflictCheckQuerySchema>;
