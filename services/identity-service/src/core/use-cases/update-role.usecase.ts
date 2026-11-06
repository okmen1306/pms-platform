import { ConflictError, NotFoundError, type AuditPublisherFn } from '@pms/shared';
import type { RoleRepository } from '../../infrastructure/database/role.repository';

/**
 * `PATCH /roles/:id` — ad/açıklama/aktiflik. `kod` DEĞİŞMEZ (başka yerlerde başvuru anahtarı).
 * Sistem rolü (`sirket_yoneticisi` vb.) pasife alınamaz; kullanıcısı olan rol pasife alınamaz
 * (pasif role atama yasak olduğundan kullanıcılar sahipsiz kalırdı).
 */
export async function updateRole(
  roleId: string,
  patch: { ad?: string; aciklama?: string | null; aktif?: boolean },
  actorUserId: string,
  repo: RoleRepository,
  publishAudit: AuditPublisherFn,
) {
  const role = await repo.findById(roleId);
  if (!role) throw new NotFoundError('Rol', roleId);
  if (patch.aktif === false && role.aktif) {
    if (role.sistem_rolu) throw new ConflictError('Sistem rolü pasife alınamaz.', { roleId });
    const users = await repo.countActiveUsers(roleId);
    if (users > 0) throw new ConflictError(`Bu role atanmış ${users} aktif kullanıcı var; önce başka role taşıyın.`, { roleId, users });
  }
  const updated = await repo.update(roleId, patch);
  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'identity_roles',
    entityId: roleId,
    ozet: `"${role.ad}" rolü güncellendi (${Object.keys(patch).join(', ')}).`,
    severity: 'info',
  });
  return updated;
}
