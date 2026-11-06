import { ValidationError } from '@pms/shared';
import type { AssignmentRepository, AssignmentRow } from '../../infrastructure/database/assignment.repository';

export interface CheckAssignmentConflictInput {
  employeeId: string;
  baslangicTarihi: string;
  bitisTarihi: string;
  /**
   * Bir atamayı DÜZENLERKEN kendisiyle çakışma raporlanmaması için (dry-run tarafında zaten
   * uygulanmıştı). NOT (B1, Day 11): roadmap.md'nin `project-service` uç nokta listesinde
   * (Bölüm 8) bir "atama düzenleme" endpoint'i YOK — sadece POST (oluştur) ve
   * PATCH /assignments/:id/complete (tamamla) planlı. Bu alan bugün İCAT EDİLMEDİ, sadece
   * yanıltıcı "Day 11+ TODO" notu düzeltildi; gerçek bir düzenleme akışı eklenirse hazır bekliyor.
   */
  excludeAssignmentId?: string;
}

export interface AssignmentConflictCheckResult {
  hasConflict: boolean;
  conflictingAssignments: AssignmentRow[];
}

/**
 * B1 (Day 8): "çakışma uyarı endpoint'i". `assign-personnel.usecase.ts` (Day 7) çakışmayı
 * yalnızca INSERT DENEYEREK öğreniyor (DB'nin `EXCLUDE USING gist` kısıtlamasına güveniyor) —
 * bu, atama formunun GÖNDER'e basmadan ÖNCE kullanıcıyı uyarabilmesi için yetersiz (F1'in
 * "AssignmentsTab + çakışma uyarı UI"sı, personel/tarih seçilir seçilmez bu uç noktayı
 * çağıracak). Bu yüzden AYNI sorguyu (`findOverlapping`) YAZMA yapmadan, salt-okunur bir
 * "dry-run" olarak tekrar kullanan ayrı bir use-case: assign-personnel'deki INSERT+catch
 * akışına dokunulmadı (o hâlâ DB seviyesindeki garantiye güveniyor — burası sadece bir
 * kullanıcı deneyimi katmanı, veri bütünlüğü garantisi DEĞİL).
 */
export async function checkAssignmentConflict(
  input: CheckAssignmentConflictInput,
  assignmentRepo: AssignmentRepository,
): Promise<AssignmentConflictCheckResult> {
  if (new Date(input.bitisTarihi) < new Date(input.baslangicTarihi)) {
    throw new ValidationError('bitisTarihi, baslangicTarihi\'nden önce olamaz');
  }

  const conflictingAssignments = await assignmentRepo.findOverlapping(
    input.employeeId,
    input.baslangicTarihi,
    input.bitisTarihi,
    input.excludeAssignmentId,
  );

  return {
    hasConflict: conflictingAssignments.length > 0,
    conflictingAssignments,
  };
}
