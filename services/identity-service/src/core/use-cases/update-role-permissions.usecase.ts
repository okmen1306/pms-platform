import type { AuditPublisherFn } from '@pms/shared';
import type { PermissionRepository, RolePermissionEntryInput } from '../../infrastructure/database/permission.repository';
import type { RoleRepository } from '../../infrastructure/database/role.repository';

/** docs/roadmap.md Bölüm 17.3 madde 4 — tüm matris tek "Kaydet" ile PUT edilir. */
export async function updateRolePermissions(
  roleId: string,
  entries: RolePermissionEntryInput[],
  actorUserId: string,
  roleRepo: RoleRepository,
  permissionRepo: PermissionRepository,
  publishAudit: AuditPublisherFn,
  publishPermissionsUpdated: (event: { roleId: string; permissionKeys: string[]; updatedBy: string }) => Promise<void>,
): Promise<void> {
  const role = await roleRepo.findById(roleId);
  if (!role) throw new Error(`Rol bulunamadı: ${roleId}`);

  await permissionRepo.upsertRolePermissions(roleId, entries);

  await publishPermissionsUpdated({
    roleId,
    permissionKeys: entries.map((e) => e.permissionId),
    updatedBy: actorUserId,
  });
  await publishAudit({
    eventType: 'PERMISSION_CHANGE',
    actorUserId,
    actorEmail: null,
    entityType: 'identity_role_permissions',
    entityId: roleId,
    ozet: `"${role.ad}" rolünün izin matrisi güncellendi (${entries.length} izin).`,
    severity: 'warning',
  });
}
