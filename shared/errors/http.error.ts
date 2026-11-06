import { AppError } from './app.error';

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', 404, `${entity} bulunamadı (id: ${id})`, { entity, id });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', 422, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Kimlik doğrulama gerekli') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Bu işlem için yetkiniz yok') {
    super('FORBIDDEN', 403, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', 409, message, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(serviceName: string) {
    super('SERVICE_UNAVAILABLE', 503, `${serviceName} şu anda yanıt vermiyor`, { serviceName });
  }
}

/**
 * B/Q (Day 8 — gerçek çalışma zamanı hatası, bkz. CHANGELOG.md): `@fastify/rate-limit`'in
 * `errorResponseBuilder`'ı döndürdüğü değeri `throw` eder (bkz. node_modules/@fastify/rate-limit/
 * index.js satır ~261) ve bunun bir `Error` (bir `.statusCode` alanına sahip) olmasını BEKLER.
 * api-gateway'in Day 7'deki `rate-limit.middleware.ts`'i bunun yerine ÇIPLAK BİR OBJE
 * döndürüyordu — `registerErrorHandler`'ın generic dalı (error-handler.helper.ts) böyle bir
 * objede `.statusCode` bulamayınca sessizce 500'e düşüyordu (429 asla üretilmiyordu). Bu, hiçbir
 * runtime testi olmadığı için Day 7'de fark edilmemişti; Day 8'in ilk api-gateway entegrasyon
 * testi bunu YAKALADI. Diğer tüm AppError alt sınıfları gibi burada da `toResponse()` üzerinden
 * standart zarfa uyuluyor.
 */
export class RateLimitExceededError extends AppError {
  constructor(retryAfterSeconds: number, max: number, timeWindowMs: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      429,
      `Çok fazla istek gönderildi. Lütfen ${retryAfterSeconds} saniye sonra tekrar deneyin.`,
      { max, timeWindowMs },
    );
  }
}
