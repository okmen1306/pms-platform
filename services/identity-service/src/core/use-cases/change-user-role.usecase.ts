import { ConflictError, NotFoundError, ValidationError, type AuditPublisherFn } from '@pms/shared';
import { assertCanAssignRole, type UserAdminDeps } from './create-user.usecase';

/**
 * `PATCH /users/:id/role`. Kurallar: kendi rolünü değiştiremez (yönetici kendini kilitleyemez /
 * yetkisini sessizce düşüremez); pasif role atanamaz; aynı rol 409; yetki yükseltme koruması
 * (`assertCanAssignRole`). Mevcut oturumun JWT'sindeki `roleKod`/izinler en geç access token
 * süresi (15 dk) sonunda yenilenir — izinler gateway'de her istekte taze okunur, bu yüzden
 * rol değişikliği yetki açısından hemen etkilidir.
 */
export async function changeUserRole(userId: string, roleId: string, actorUserId: string, deps: UserAdminDeps & { publishAudit: AuditPublisherFn }) {
  if (userId === actorUserId) throw new ConflictError('Kendi rolünüzü değiştiremezsiniz.');
  const user = await deps.userRepo.findById(userId);
  if (!user) throw new NotFoundError('Kullanıcı', userId);
  const role = await deps.roleRepo.findById(roleId);
  if (!role) throw new NotFoundError('Rol', roleId);
  if (!role.aktif) throw new ValidationError('Pasif bir role kullanıcı atanamaz.', { roleId });
  if (user.role_id === role.id) throw new ConflictError('Kullanıcı zaten bu rolde.');

  await assertCanAssignRole(actorUserId, role, deps);
  const previous = await deps.roleRepo.findById(user.role_id);
  await deps.userRepo.updateRole(userId, role.id);

  await deps.publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'identity_users',
    entityId: userId,
    ozet: `${user.email} kullanıcısının rolü "${previous?.ad ?? user.role_id}" → "${role.ad}" olarak değiştirildi.`,
    severity: 'warning',
  });
  return { id: userId, roleId: role.id, roleKod: role.kod };
}
