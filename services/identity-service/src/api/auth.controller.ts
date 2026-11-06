import type { FastifyInstance } from 'fastify';
import { LoginDtoSchema, ok } from '@pms/shared';
import { loginUser, type LoginUserDeps } from '../core/use-cases/login-user.usecase';
import {
  issueRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  type RefreshDeps,
} from '../core/use-cases/refresh-token.usecase';

export interface AuthControllerDeps extends LoginUserDeps, RefreshDeps {
  /** Tarayıcının gördüğü yol (gateway prefix'i DAHİL) — bkz. config/service.config.ts Day 18 notu. */
  refreshCookiePath: string;
  cookieSecure: boolean;
}

/**
 * POST /auth/login, /auth/refresh, /auth/logout — bkz. docs/roadmap.md Bölüm 8 identity-service.
 * Cookie/header stratejisi: access token JSON body'de döner (frontend hafızada tutar),
 * refresh token httpOnly cookie olarak set edilir (XSS'e karşı).
 */
export function registerAuthRoutes(app: FastifyInstance, deps: AuthControllerDeps) {
  app.post('/auth/login', async (request, reply) => {
    const body = LoginDtoSchema.parse(request.body);
    const result = await loginUser(body.email, body.password, deps);
    const refreshToken = await issueRefreshToken(result.user.id, deps);

    reply.setCookie('pms_refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: deps.cookieSecure,
      path: deps.refreshCookiePath,
      maxAge: deps.refreshTtlDays * 24 * 60 * 60,
    });

    return ok({ accessToken: result.accessToken, user: result.user });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const rawRefreshToken = request.cookies?.pms_refresh_token;
    if (!rawRefreshToken) {
      return reply.code(401).send({ success: false, data: null, meta: null, error: { code: 'UNAUTHORIZED', message: 'Refresh token bulunamadı' } });
    }
    const result = await refreshAccessToken(rawRefreshToken, deps);
    return ok({ accessToken: result.accessToken });
  });

  app.post('/auth/logout', async (request, reply) => {
    const rawRefreshToken = request.cookies?.pms_refresh_token;
    if (rawRefreshToken) {
      await revokeRefreshToken(rawRefreshToken, deps);
    }
    reply.clearCookie('pms_refresh_token', { path: deps.refreshCookiePath });
    return ok({ loggedOut: true });
  });
}
