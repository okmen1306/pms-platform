import { apiFetch, refreshAccessToken, tokenStore } from '../../shared/api';

export interface LoginResult {
  accessToken: string;
  user: { id: string; email: string; roleKod: string; isSuperAdmin: boolean; dilTercihi: 'tr' | 'en'; mustChangePassword?: boolean };
}

export type AuthUser = LoginResult['user'];

/**
 * Day 18: mock KALDIRILDI (Day 2'den beri duran `setTimeout` + "e-posta yonetici ile başlıyorsa
 * yönetici" sezgisi, bkz. eski Q Day 10 notu — "Day 18'de tamamen kaldırılacak"). Artık gerçek
 * `POST /identity/auth/login`, api-gateway üzerinden (bkz. api-gateway/src/routes/identity.routes.ts
 * — `/identity/auth/*` JWT'siz proxy'lenir, "tavuk-yumurta" problemi).
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  if (!email || !password) {
    throw new Error('E-posta ve parola zorunludur');
  }
  const result = await apiFetch<LoginResult>('/identity/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
    fallbackError: 'Giriş yapılamadı',
  });
  tokenStore.set(result.accessToken);
  return result;
}

/** Sunucudaki refresh token'ı iptal eder + httpOnly cookie'yi temizler; hata olsa bile yerel oturum düşer. */
export async function logout(): Promise<void> {
  try {
    await apiFetch('/identity/auth/logout', { method: 'POST', skipAuth: true });
  } catch {
    // Ağ hatası olsa da kullanıcı yerelde çıkış yapmış olmalı — access token zaten kısa ömürlü (15dk).
  } finally {
    tokenStore.set(null);
  }
}

/**
 * Sayfa yenilenince oturumu geri yükler: httpOnly refresh cookie'siyle yeni access token alır,
 * kullanıcıyı token'ın payload'ından okur (`POST /auth/refresh` sadece `{accessToken}` döner).
 * Payload burada DOĞRULANMAZ (istemcide secret yok) — sadece arayüz kararları (rol/izin gizleme)
 * için okunur; gerçek doğrulama ve yetkilendirme her istekte api-gateway'de yapılır.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  const token = await refreshAccessToken();
  return token ? decodeUserFromJwt(token) : null;
}

export function decodeUserFromJwt(token: string): AuthUser | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string' || typeof claims.roleKod !== 'string') return null;
    return {
      id: claims.sub,
      email: claims.email,
      roleKod: claims.roleKod,
      isSuperAdmin: claims.isSuperAdmin === true,
      dilTercihi: claims.dilTercihi === 'en' ? 'en' : 'tr',
      mustChangePassword: claims.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}

/**
 * Day 22 (G-02): kullanıcı kendi parolasını değiştirir (geçici parola dahil). Gateway `mustChangePassword`
 * bayraklı token için YALNIZCA bu uca ve `me/effective-permissions`a izin verir.
 */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch('/identity/me/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
    fallbackError: 'Parola değiştirilemedi',
  });
}
