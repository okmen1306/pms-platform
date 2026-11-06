import bcrypt from 'bcrypt';
import { UnauthorizedError, ValidationError, validatePasswordPolicy, type AuditPublisherFn } from '@pms/shared';
import type { UserRepository } from '../../infrastructure/database/user.repository';

/**
 * Kullanıcı KENDİ parolasını değiştirir (geçici parola dahil). Mevcut parola doğrulanır (çalınmış
 * oturumla parola değişmesin); yeni parola politikaya uymalı ve eskisinden farklı olmalı. Başarılı
 * değişimde `must_change_password` kapanır.
 */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  deps: { userRepo: UserRepository; publishAudit: AuditPublisherFn },
): Promise<void> {
  const user = await deps.userRepo.findById(userId);
  if (!user || !user.is_active) throw new UnauthorizedError('Kullanıcı bulunamadı veya pasif.');
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) throw new UnauthorizedError('Mevcut parola hatalı.');

  const errors = validatePasswordPolicy(newPassword);
  if (errors.length > 0) throw new ValidationError('Parola politikasına uymuyor.', { errors });
  if (await bcrypt.compare(newPassword, user.password_hash)) throw new ValidationError('Yeni parola mevcut parolayla aynı olamaz.');

  await deps.userRepo.updatePassword(userId, await bcrypt.hash(newPassword, 10), false);
  await deps.publishAudit({
    eventType: 'UPDATE',
    actorUserId: userId,
    actorEmail: user.email,
    entityType: 'identity_users',
    entityId: userId,
    ozet: `${user.email} parolasını değiştirdi.`,
    severity: 'info',
  });
}
