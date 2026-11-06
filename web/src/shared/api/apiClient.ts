import { tokenStore } from './tokenStore';

/**
 * Day 18 (Entegrasyon Haftası): Day 3-5'ten beri her `*.api.ts` dosyası servislere DOĞRUDAN,
 * kimlik bilgisiz `fetch` ile bağlanıyordu (bkz. personnel.api.ts eski başlık notu: "Day 18
 * entegrasyon haftasında bu, api-gateway proxy'sinden geçecek"). Bu dosya o tekrarlanan
 * boilerplate'in TEK yerde toplanmış hâli: gateway taban URL'i, `Authorization: Bearer`, standart
 * `{success, data, meta, error}` zarfının açılması, hata normalizasyonu ve 401'de TEK SEFERLİK
 * sessiz refresh + yeniden deneme.
 */
export const API_BASE_URL = String(import.meta.env.VITE_API_GATEWAY_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type SessionExpiredListener = () => void;
let sessionExpiredListener: SessionExpiredListener | null = null;

/** Refresh de başarısız olunca (oturum gerçekten bitti) AuthContext'in kullanıcıyı düşürmesi için. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListener = listener;
  return () => {
    if (sessionExpiredListener === listener) sessionExpiredListener = null;
  };
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * httpOnly refresh cookie'siyle yeni bir access token ister. Aynı anda birden fazla çağrı
 * (ör. React StrictMode'un çift effect'i veya aynı anda 401 alan paralel istekler) TEK bir ağ
 * isteğine indirgenir.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/identity/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (!response.ok) return null;
        const body = await response.json();
        const token = body?.data?.accessToken;
        if (typeof token !== 'string') return null;
        tokenStore.set(token);
        return token;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Login/logout/refresh gibi JWT'siz uç noktalar: Authorization eklenmez, 401'de refresh denenmez. */
  skipAuth?: boolean;
  /** Sunucu bir hata mesajı döndürmezse kullanılacak alana özgü mesaj (ör. "Personel listesi alınamadı"). */
  fallbackError?: string;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, skipAuth, fallbackError, headers, ...rest } = options;

  const send = async (): Promise<Response> => {
    const requestHeaders = new Headers(headers);
    if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
    const token = tokenStore.get();
    if (!skipAuth && token) requestHeaders.set('Authorization', `Bearer ${token}`);
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        headers: requestHeaders,
        // Refresh cookie'si için (gateway CORS'ta `credentials: true` + açık origin izin listesi).
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamadı. Lütfen bağlantınızı kontrol edin.');
    }
  };

  let response = await send();

  if (response.status === 401 && !skipAuth) {
    const renewed = await refreshAccessToken();
    if (renewed) {
      response = await send();
    } else {
      tokenStore.set(null);
      sessionExpiredListener?.();
    }
  }

  const text = await response.text();
  let json: any = null; // sunucu zarfı: { success, data, meta, error }
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message = json?.error?.message ?? (fallbackError ? `${fallbackError} (${response.status})` : `İstek başarısız (${response.status})`);
    throw new ApiError(response.status, json?.error?.code ?? `HTTP_${response.status}`, message, json?.error?.details);
  }

  return json?.data as T;
}
