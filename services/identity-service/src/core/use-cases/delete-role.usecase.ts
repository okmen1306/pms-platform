import type { AuditPublisherFn } from '@pms/shared';
import type { RoleRepository } from '../../infrastructure/database/role.repository';

/**
 * Kural: sistem_rolu=TRUE olan roller silinemez; kullanılan roller RoleInUseCannotDeleteError
 * fırlatır (repository katmanında kontrol edilir, bkz. role.repository.ts).
 */
export async function deleteRole(
  roleId: string,
  actorUserId: string,
  repo: RoleRepository,
  publishAudit: AuditPublisherFn,
  publishRoleDeleted: (event: { roleId: string; kod: string; deletedBy: string }) => Promise<void>,
): Promise<void> {
  const role = await repo.findById(roleId);
  if (!role) throw new Error(`Rol bulunamadı: ${roleId}`);

  await repo.delete(roleId); // hata durumunda burada fırlar, aşağıya inmez

  await publishRoleDeleted({ roleId, kod: role.kod, deletedBy: actorUserId });
  await publishAudit({
    eventType: 'DELETE',
    actorUserId,
    actorEmail: null,
    entityType: 'identity_roles',
    entityId: roleId,
    ozet: `"${role.ad}" rolü silindi.`,
    severity: 'warning',
  });
}
