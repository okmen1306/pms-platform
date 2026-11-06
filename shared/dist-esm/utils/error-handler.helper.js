import { ZodError } from 'zod';
import { AppError } from '../errors/app.error';
/**
 * Q (Day 7 — Uzman İnisiyatifi, bkz. CHANGELOG.md): tüm servislerde eksik olan ortak hata
 * dönüştürücü. `AppError` alt sınıfları (ConflictAssignmentError, NotFoundError, ValidationError,
 * vb.) Day 1'den beri `toResponse()` metoduna sahipti ama HİÇBİR serviste Fastify'a bağlanmamıştı
 * — yani bir use-case `throw new ConflictAssignmentError(...)` yaptığında Fastify bunu generic
 * 500 Internal Server Error'a çeviriyordu; roadmap.md Bölüm 8'deki standart
 * `{success:false,data:null,error:{code,message,details}}` yanıtı hiç üretilmiyordu.
 *
 * Day 7'nin çakışma (409) ve kapasite (422) hatalarının doğru HTTP durum koduyla dönebilmesi
 * için bu düzeltme ZORUNLU olduğundan, geriye dönük olarak TÜM servislere uygulanıyor
 * (her `app.ts`'de `registerErrorHandler(app)` tek satırlık çağrı — bkz. CHANGELOG.md Day 7).
 */
export function registerErrorHandler(app) {
    // Day 16 (güvenlik taraması tamamlama — fastify 4->5 bump): Fastify v5'te `setErrorHandler`'ın
    // generic'i artık `unknown`'a varsayılıyor (v4'te örtük olarak `FastifyError`'dı) — bu yüzden
    // `error` parametresi burada AÇIKÇA tiplenmek ZORUNDA, yoksa `.statusCode`/`.message`
    // erişimleri derleme hatası verir. `AppError`/`ZodError` kontrollerinden SONRAKİ tüm hatalar
    // zaten Fastify'ın kendisinden veya bir plugin'den geliyor (ör. 404 Not Found,
    // @fastify/rate-limit'in kendi hataları) — hepsi gerçekten `FastifyError` şeklinde.
    app.setErrorHandler((error, request, reply) => {
        if (error instanceof AppError) {
            reply.status(error.statusCode).send(error.toResponse());
            return;
        }
        if (error instanceof ZodError) {
            reply.status(422).send({
                success: false,
                data: null,
                meta: null,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'İstek gövdesi/parametreleri geçersiz.',
                    details: { issues: error.issues },
                },
            });
            return;
        }
        const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
        if (statusCode >= 500) {
            request.log.error(error);
        }
        reply.status(statusCode).send({
            success: false,
            data: null,
            meta: null,
            error: {
                code: statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
                message: statusCode === 500 ? 'Beklenmeyen bir hata oluştu.' : error.message,
                details: null,
            },
        });
    });
}
