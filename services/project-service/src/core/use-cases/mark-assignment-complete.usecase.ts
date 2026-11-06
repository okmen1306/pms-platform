import { NotFoundError, type AuditPublisherFn } from '@pms/shared';
import type { AssignmentRepository, AssignmentRow } from '../../infrastructure/database/assignment.repository';

/**
 * Personel, kendisine atanan görevi tamamladığında çağırır. Bu, notification-service'in
 * gecikme cron'unun (delay-check.cron.ts, Day 7) bir görevi "hâlâ gecikmiş mi?" diye tekrar
 * doğrulaması için gereken tek yazma işlemi — bkz. GET /assignments/:id.
 *
 * NOT: Bu, roadmap.md event kataloğundaki `work_package.completed` event'ini YAYINLAMAZ —
 * o event tüm iş paketinin (tüm alt görevleriyle) tamamlanmasıyla ilgili daha geniş kapsamlı bir
 * iş kuralı olup ayrı bir günde ele alınacak (bkz. Sıradaki Gün notları). Burada sadece TEK bir
 * atamanın tamamlanma durumu işaretlenir.
 */
export async function markAssignmentComplete(
  assignmentId: string,
  tamamlanmaTarihi: string | undefined,
  actorUserId: string,
  assignmentRepo: AssignmentRepository,
  publishAudit: AuditPublisherFn,
): Promise<AssignmentRow> {
  const existing = await assignmentRepo.findById(assignmentId);
  if (!existing) {
    throw new NotFoundError('Personel ataması', assignmentId);
  }

  const updated = await assignmentRepo.markComplete(assignmentId, tamamlanmaTarihi ?? new Date().toISOString());

  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'project_personnel_assignments',
    entityId: assignmentId,
    ozet: `Personel ataması (${assignmentId}) tamamlandı olarak işaretlendi.`,
    severity: 'info',
  });

  return updated;
}
