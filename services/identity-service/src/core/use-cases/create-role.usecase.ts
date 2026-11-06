import type { AuditPublisherFn } from '@pms/shared';
import type { RoleRepository, RoleRow } from '../../infrastructure/database/role.repository';

export interface CreateRoleInput {
  kod: string;
  ad: string;
  aciklama?: string;
  copyPermissionsFromRoleId?: string;
}

/** docs/roadmap.md Bölüm 17.3 madde 2 — boştan veya mevcut bir rolden "kopyala" ile başlar. */
export async function createRole(
  input: CreateRoleInput,
  actorUserId: string,
  repo: RoleRepository,
  publishAudit: AuditPublisherFn,
  publishRoleCreated: (event: { roleId: string; kod: string; createdBy: string }) => Promise<void>,
): Promise<RoleRow> {
  const created = await repo.create({
    kod: input.kod,
    ad: input.ad,
    aciklama: input.aciklama,
    createdBy: actorUserId,
  });

  if (input.copyPermissionsFromRoleId) {
    await repo.copyPermissionsFromRole(input.copyPermissionsFromRoleId, created.id);
  }

  await publishRoleCreated({ roleId: created.id, kod: created.kod, createdBy: actorUserId });
  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'identity_roles',
    entityId: created.id,
    ozet: `"${created.ad}" rolü oluşturuldu.`,
    severity: 'info',
  });

  return created;
}
