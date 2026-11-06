import { z } from 'zod';

/**
 * identity_users tablosuyla birebir uyumlu DTO.
 * Not: password_hash ASLA bu DTO üzerinden dışarı çıkmaz — response serialization'da
 * her zaman ayrı bir "public" şema kullanılır (bkz. UserPublicSchema).
 */
export const UserSchema = z.object({
  id: z.guid(),
  email: z.string().email(),
  roleId: z.guid(),
  isSuperAdmin: z.boolean().default(false),
  personnelId: z.guid().nullable(),
  dilTercihi: z.enum(['tr', 'en']).default('tr'),
  isActive: z.boolean().default(true),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// Dışarı (API response) verilecek güvenli alan seti
export const UserPublicSchema = UserSchema.omit({});
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const CreateUserDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Parola en az 8 karakter olmalı'),
  roleId: z.guid(),
  personnelId: z.guid().nullable().optional(),
  dilTercihi: z.enum(['tr', 'en']).default('tr'),
});
export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const AssignRoleDtoSchema = z.object({
  roleId: z.guid(),
});
export type AssignRoleDto = z.infer<typeof AssignRoleDtoSchema>;

// JWT payload sözleşmesi — api-gateway bunu üretir, tüm servisler bunu okur.
export const JwtPayloadSchema = z.object({
  sub: z.guid(),        // user id
  email: z.string().email(),
  roleId: z.guid(),
  roleKod: z.string(),
  isSuperAdmin: z.boolean(),
  personnelId: z.guid().nullable(),
  dilTercihi: z.enum(['tr', 'en']),
  // Day 22: geçici parolayla giriş — true iken gateway yalnızca parola değiştirme/izin okuma uçlarına izin verir.
  // Opsiyonel: bayraktan ÖNCE üretilmiş token'lar (ve test token'ları) false sayılır.
  mustChangePassword: z.boolean().optional(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
