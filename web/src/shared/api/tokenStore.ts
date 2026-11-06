/**
 * Day 18: access token SADECE bellekte tutulur (localStorage/sessionStorage YOK) — identity-service
 * tasarımının kendisi bunu böyle istiyor (bkz. services/identity-service/src/api/auth.controller.ts:
 * "access token JSON body'de döner (frontend hafızada tutar), refresh token httpOnly cookie").
 * XSS ile çalınabilecek kalıcı bir yerde token durmaz; sayfa yenilenince oturum, httpOnly refresh
 * cookie'siyle sessizce geri yüklenir (bkz. auth.api.ts `restoreSession`).
 */
let accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string | null): void => {
    accessToken = token;
  },
};
