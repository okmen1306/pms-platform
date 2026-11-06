import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@pms/shared';
import type { UserRepository } from '../../infrastructure/database/user.repository';
import type { RoleRepository } from '../../infrastructure/database/role.repository';
import type { AuditPublisherFn } from '@pms/shared';

export interface LoginUserDeps {
  userRepo: UserRepository;
  roleRepo: RoleRepository;
  jwtSecret: string;
  jwtExpiresIn: string; // örn. '15m'
  publishAudit: AuditPublisherFn;
}

export interface LoginUserResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    roleKod: string;
    isSuperAdmin: boolean;
    dilTercihi: 'tr' | 'en';
    /** Day 22: true ise web yalnızca parola değiştirme ekranını gösterir (geçici parola). */
    mustChangePassword: boolean;
  };
}

/**
 * Kural: parola bcrypt ile karşılaştırılır, JWT payload'ı shared/dto/user.dto.ts
 * JwtPayloadSchema ile birebir eşleşir (api-gateway Day 6-8'de bu şemayı doğrulayacak).
 */
export async function loginUser(
  email: string,
  password: string,
  deps: LoginUserDeps,
): Promise<LoginUserResult> {
  const user = await deps.userRepo.findByEmail(email);
  if (!user || !user.is_active) {
    throw new UnauthorizedError('E-posta veya parola hatalı');
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    throw new UnauthorizedError('E-posta veya parola hatalı');
  }

  const role = await deps.roleRepo.findById(user.role_id);
  if (!role) {
    throw new UnauthorizedError('Kullanıcının rolü bulunamadı');
  }

  const payload = {
    sub: user.id,
    email: user.email,
    roleId: user.role_id,
    roleKod: role.kod,
    isSuperAdmin: user.is_super_admin,
    personnelId: user.personnel_id,
    dilTercihi: user.dil_tercihi,
    mustChangePassword: user.must_change_password ?? false,
  };

  // Q (Day 8 — tam derleme taraması, bkz. CHANGELOG.md): `@types/jsonwebtoken`, `expiresIn`
  // için `ms` paketinin `StringValue` literal union tipini bekliyor, düz `string` DEĞİL —
  // `jwtExpiresIn: string` (env'den geldiği için kaçınılmaz) bu yüzden hiçbir overload'a
  // uymuyordu. Çalışma zamanında jsonwebtoken zaten herhangi bir geçerli süre string'ini
  // kabul ediyor; bu sadece bir tip daraltma castı, davranış DEĞİŞMEDİ.
  const accessToken = jwt.sign(payload, deps.jwtSecret, {
    expiresIn: deps.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });

  await deps.userRepo.updateLastLogin(user.id);

  await deps.publishAudit({
    eventType: 'LOGIN',
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'identity_users',
    entityId: user.id,
    ozet: `${user.email} sisteme giriş yaptı.`,
    severity: 'info',
  });

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      roleKod: role.kod,
      isSuperAdmin: user.is_super_admin,
      dilTercihi: user.dil_tercihi,
      mustChangePassword: user.must_change_password ?? false,
    },
  };
}
