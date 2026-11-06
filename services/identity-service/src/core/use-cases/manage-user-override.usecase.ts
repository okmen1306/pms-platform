import type { AuditPublisherFn } from '@pms/shared';
import type { PermissionRepository, GrantOverrideInput } from '../../infrastructure/database/permission.repository';
import type { PermissionRow } from '../../infrastructure/database/permission.repository';

/**
 * Kural (docs/roadmap.md Bölüm 17): rolü DEĞİŞTİRMEDEN kullanıcıya tekil izin ver/kısıtla.
 * Gerekçe zorunludur (GrantUserPermissionOverrideDtoSchema.gerekce min 5 karakter) — denetim
 * kaydında "neden verildiği" her zaman görünür olsun diye.
 */
export async function grantUserPermissionOverride(
  targetUserId: string,
  input: GrantOverrideInput,
  permission: PermissionRow,
  permissionRepo: PermissionRepository,
  publishAudit: AuditPublisherFn,
  publishOverridden: (event: {
    userId: string;
    permissionKey: string;
    canView: boolean | null;
    canEdit: boolean | null;
    grantedBy: string;
    gerekce: string;
  }) => Promise<void>,
): Promise<unknown> {
  const result = await permissionRepo.grantUserOverride(targetUserId, input);

  await publishOverridden({
    userId: targetUserId,
    permissionKey: permission.permission_key,
    canView: input.canView ?? null,
    canEdit: input.canEdit ?? null,
    grantedBy: input.grantedBy,
    gerekce: input.gerekce,
  });
  await publishAudit({
    eventType: 'PERMISSION_CHANGE',
    actorUserId: input.grantedBy,
    actorEmail: null,
    entityType: 'identity_user_permission_overrides',
    entityId: targetUserId,
    ozet: `Kullanıcıya (${targetUserId}) "${permission.permission_key}" izni tekil olarak verildi. Gerekçe: ${input.gerekce}`,
    severity: 'warning',
  });

  return result;
}

export async function revokeUserPermissionOverride(
  targetUserId: string,
  overrideId: string,
  actorUserId: string,
  permissionRepo: PermissionRepository,
  publishAudit: AuditPublisherFn,
): Promise<void> {
  await permissionRepo.revokeUserOverride(targetUserId, overrideId);

  await publishAudit({
    eventType: 'PERMISSION_CHANGE',
    actorUserId,
    actorEmail: null,
    entityType: 'identity_user_permission_overrides',
    entityId: targetUserId,
    ozet: `Kullanıcının (${targetUserId}) tekil izni geri alındı.`,
    severity: 'warning',
  });
}

export async function getPermissionCatalog(permissionRepo: PermissionRepository): Promise<PermissionRow[]> {
  return permissionRepo.findAllCatalog();
}

export async function getEffectivePermissions(userId: string, permissionRepo: PermissionRepository) {
  return permissionRepo.getEffectivePermissions(userId);
}
