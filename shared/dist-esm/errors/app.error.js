/**
 * Tüm servislerdeki tüm iş kuralı hatalarının atası. Fastify error handler'ı bu sınıfı
 * yakalayıp roadmap.md Bölüm 8'deki standart yanıt formatına ({success:false, error:{...}})
 * çevirir. Servis kodu asla çıplak `throw new Error(...)` kullanmaz.
 */
export class AppError extends Error {
    code;
    statusCode;
    details;
    constructor(code, statusCode, message, details) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
    toResponse() {
        return {
            success: false,
            data: null,
            meta: null,
            error: {
                code: this.code,
                message: this.message,
                details: this.details ?? null,
            },
        };
    }
}
