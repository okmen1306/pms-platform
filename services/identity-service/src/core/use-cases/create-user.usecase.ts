import bcrypt from 'bcrypt';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, validatePasswordPolicy, type AuditPublisherFn } from '@pms/shared';
import type { UserRepository, UserListItem } from '../../infrastructure/database/user.repository';
import { toUserListItem } from '../../infrastructure/database/user.repository';
import type { RoleRepository, RoleRow } from '../../infrastructure/database/role.repository';
import type { PermissionRepository } from '../../infrastructure/database/permission.repository';

export interface CreateUserInput {
  email: string;
  /** Yöneticinin belirlediği GEÇİCİ parola; kullanıcı ilk girişte değiştirmek zorunda. */
  temporaryPassword: string;
  roleId: string;
  personnelId?: string | null;
  dilTercihi?: 'tr' | 'en';
}

export interface UserAdminDeps {
  userRepo: UserRepository;
  roleRepo: RoleRepository;
  permissionRepo: PermissionRepository;
  publishAudit: AuditPublisherFn;
}

/**
 * Yetki yükseltme koruması (Day 22): `POST /users` ik_yoneticisi'ne açıktır; ik, kendine/başkasına
 * `sirket_yoneticisi` gibi bir rol vererek tüm sistemi ele geçirebilirdi. Kural: hedef rolün verdiği
 * herhangi bir `admin.*` izni, işlemi yapan kullanıcıda ETKİN olarak yoksa reddedilir. Süper admin
 * her rolü atayabilir. (ik, `admin.users.manage` taşıdığı için kendi seviyesindeki rolü de atayabilir.)
 */
export async function assertCanAssignRole(actorUserId: string, targetRole: RoleRow, deps: UserAdminDeps): Promise<void> {
  const actor = await deps.userRepo.findById(actorUserId);
  if (!actor || !actor.is_active) throw new ForbiddenError('İşlemi yapan kullanıcı bulunamadı veya pasif.');
  if (actor.is_super_admin) return;

  const [rolePerms, actorPerms] = await Promise.all([
    deps.permissionRepo.findRolePermissions(targetRole.id),
    deps.permissionRepo.getEffectivePermissions(actorUserId),
  ]);
  const actorHolds = (key: string, edit: boolean) =>
    actorPerms.some((p) => p.permission_key === key && (edit ? p.can_edit : p.can_view));
  const escalating = rolePerms.filter(
    (p) => p.permissionKey.startsWith('admin.') && ((p.canView && !actorHolds(p.permissionKey, false)) || (p.canEdit && !actorHolds(p.permissionKey, true))),
  );
  if (escalating.length > 0) {
    throw new ForbiddenError(`"${targetRole.ad}" rolünü atama yetkiniz yok: sahip olmadığınız yönetim izinleri veriyor (${escalating.map((p) => p.permissionKey).join(', ')}).`);
  }
}

export async function createUser(input: CreateUserInput, actorUserId: string, deps: UserAdminDeps): Promise<UserListItem> {
  const policyErrors = validatePasswordPolicy(input.temporaryPassword);
  if (policyErrors.length > 0) throw new ValidationError('Parola politikasına uymuyor.', { errors: policyErrors });

  const email = input.email.trim().toLowerCase();
  if (await deps.userRepo.findByEmail(email)) throw new ConflictError('Bu e-posta ile bir kullanıcı zaten var.', { email });

  const role = await deps.roleRepo.findById(input.roleId);
  if (!role) throw new NotFoundError('Rol', input.roleId);
  if (!role.aktif) throw new ValidationError('Pasif bir role kullanıcı atanamaz.', { roleId: role.id });

  await assertCanAssignRole(actorUserId, role, deps);

  const row = await deps.userRepo.create({
    email,
    password_hash: await bcrypt.hash(input.temporaryPassword, 10),
    role_id: role.id,
    personnel_id: input.personnelId ?? null,
    dil_tercihi: input.dilTercihi ?? 'tr',
    must_change_password: true,
  });

  await deps.publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'identity_users',
    entityId: row.id,
    ozet: `${email} kullanıcısı "${role.ad}" rolüyle oluşturuldu.`,
    severity: 'info',
  });
  return toUserListItem(row, role);
}
