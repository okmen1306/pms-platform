import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { AppError, JwtPayloadSchema, UnauthorizedError, type JwtPayload } from '@pms/shared';

/**
 * Day 22 (G-02): geçici parolayla giriş yapmış (`mustChangePassword`) kullanıcı, parolasını değiştirene
 * kadar YALNIZCA şu uçlara erişebilir; geri kalan her şey 403 `PASSWORD_CHANGE_REQUIRED`. Bayrak
 * sunucuda zorlanır — yalnızca web ekranına güvenilmez (API'yi doğrudan çağıran biri atlayamaz).
 * Parola değişince mevcut token bayrağı taşımaya devam eder; yeni token için yeniden giriş/refresh gerekir.
 */
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set(['/identity/me/password', '/identity/me/effective-permissions']);

declare module 'fastify' {
  interface FastifyRequest {
    actor?: JwtPayload;
  }
}

/**
 * Day 4 (TL): JWT doğrulama iskeleti. identity-service'in ürettiği token'ı (bkz.
 * services/identity-service/src/core/use-cases/login-user.usecase.ts, Day 2) burada doğrular
 * ve `request.actor`'a JwtPayload olarak enjekte eder — böylece her servis kendi JWT
 * doğrulamasını YENİDEN YAZMAZ, sadece gateway'den gelen isteğe güvenir (bkz. docs/roadmap.md
 * Bölüm 12 Güvenlik Kontrol Listesi).
 *
 * TAM proxy routing (Day 7) ve RBAC middleware (Day 6) app.ts'te bu middleware'i preHandler
 * olarak kullanıyor (bkz. routes/*.routes.ts) — bu fonksiyonun kendisi yine de bağımsız
 * test edilebilir kalması için saf tutuldu (Fastify'a özel hiçbir şey enjekte etmiyor).
 */
export function createAuthMiddleware(jwtSecret: string) {
  return async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization header eksik veya hatalı formatta');
    }

    const rawToken = authHeader.slice('Bearer '.length);
    try {
      const decoded = jwt.verify(rawToken, jwtSecret);
      request.actor = JwtPayloadSchema.parse(decoded);
    } catch {
      throw new UnauthorizedError('Token geçersiz veya süresi dolmuş');
    }
    if (request.actor.mustChangePassword) {
      const path = request.url.split('?')[0].replace(/\/$/, '');
      if (!PASSWORD_CHANGE_ALLOWED_PATHS.has(path)) {
        throw new AppError('PASSWORD_CHANGE_REQUIRED', 403, 'Geçici parolanızı değiştirmeden devam edemezsiniz.');
      }
    }
  };
}
