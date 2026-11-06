import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@pms/shared';
import type { UserRepository } from '../../infrastructure/database/user.repository';
import type { RoleRepository } from '../../infrastructure/database/role.repository';

export interface RefreshTokenStore {
  create(userId: string, tokenHash: string, expiresAt: string): Promise<void>;
  findValidByHash(tokenHash: string): Promise<{ userId: string } | null>;
  revokeByHash(tokenHash: string): Promise<void>;
}

export interface RefreshDeps {
  userRepo: UserRepository;
  roleRepo: RoleRepository;
  refreshStore: RefreshTokenStore;
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTtlDays: number;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function issueRefreshToken(userId: string, deps: RefreshDeps): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + deps.refreshTtlDays * 24 * 60 * 60 * 1000).toISOString();
  await deps.refreshStore.create(userId, hashToken(rawToken), expiresAt);
  return rawToken;
}

export async function refreshAccessToken(
  rawRefreshToken: string,
  deps: RefreshDeps,
): Promise<{ accessToken: string }> {
  const record = await deps.refreshStore.findValidByHash(hashToken(rawRefreshToken));
  if (!record) {
    throw new UnauthorizedError('Refresh token geçersiz veya süresi dolmuş');
  }

  const user = await deps.userRepo.findById(record.userId);
  if (!user || !user.is_active) {
    throw new UnauthorizedError('Kullanıcı bulunamadı veya pasif');
  }

  const role = await deps.roleRepo.findById(user.role_id);
  if (!role) {
    throw new UnauthorizedError('Kullanıcının rolü bulunamadı');
  }

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roleId: user.role_id,
      roleKod: role.kod,
      isSuperAdmin: user.is_super_admin,
      personnelId: user.personnel_id,
      dilTercihi: user.dil_tercihi,
      mustChangePassword: user.must_change_password ?? false,
    },
    deps.jwtSecret,
    // Q (Day 8 — bkz. login-user.usecase.ts'teki AYNI yorum): jsonwebtoken'ın expiresIn tipi.
    { expiresIn: deps.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  );

  return { accessToken };
}

export async function revokeRefreshToken(rawRefreshToken: string, deps: RefreshDeps): Promise<void> {
  await deps.refreshStore.revokeByHash(hashToken(rawRefreshToken));
}
