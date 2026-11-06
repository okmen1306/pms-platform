import { z } from 'zod';

/**
 * identity_users tablosuyla birebir uyumlu DTO.
 * Not: password_hash ASLA bu DTO üzerinden dışarı çıkmaz — response serialization'da
 * her zaman ayrı bir "public" şema kullanılır (bkz. UserPublicSchema).
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  roleId: z.string().uuid(),
  isSuperAdmin: z.boolean().default(false),
  personnelId: z.string().uuid().nullable(),
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
  roleId: z.string().uuid(),
  personnelId: z.string().uuid().nullable().optional(),
  dilTercihi: z.enum(['tr', 'en']).default('tr'),
});
export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const AssignRoleDtoSchema = z.object({
  roleId: z.string().uuid(),
});
export type AssignRoleDto = z.infer<typeof AssignRoleDtoSchema>;

// JWT payload sözleşmesi — api-gateway bunu üretir, tüm servisler bunu okur.
export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),        // user id
  email: z.string().email(),
  roleId: z.string().uuid(),
  roleKod: z.string(),
  isSuperAdmin: z.boolean(),
  personnelId: z.string().uuid().nullable(),
  dilTercihi: z.enum(['tr', 'en']),
  // Day 22: geçici parolayla giriş — true iken gateway yalnızca parola değiştirme/izin okuma uçlarına izin verir.
  // Opsiyonel: bayraktan ÖNCE üretilmiş token'lar (ve test token'ları) false sayılır.
  mustChangePassword: z.boolean().optional(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
