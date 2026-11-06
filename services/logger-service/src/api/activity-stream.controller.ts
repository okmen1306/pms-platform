import type { FastifyInstance } from 'fastify';
import type { SseBroadcaster } from '../infrastructure/realtime/sse-broadcaster';

/**
 * TL (Day 10): "Canlı Aktivite Akışı" uç noktası. RBAC (admin.audit_log) burada DEĞİL —
 * api-gateway'in `/logger/*` proxy'si zaten bunu istiyor (bkz. api-gateway/src/routes/
 * logger.routes.ts, Day 6'da hazırlanmış ama logger-service'in henüz bir route'u olmadığından
 * boşta bekliyordu — bugün karşılığını buluyor).
 */
export function registerActivityStreamRoutes(app: FastifyInstance, deps: { broadcaster: SseBroadcaster }) {
  app.get('/admin/activity-feed/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // İlk baytı hemen gönder — bazı proxy/tarayıcılar bağlantının GERÇEKTEN açık olduğunu
    // ilk veri gelene kadar anlamayabilir.
    reply.raw.write(':ok\n\n');

    deps.broadcaster.subscribe(reply);
    request.raw.on('close', () => {
      deps.broadcaster.unsubscribe(reply);
    });

    // Fastify'a bu isteğin YANITININ elle (reply.raw ile) yönetildiğini, normal reply.send()
    // akışının BEKLEMEMESİ gerektiğini söyler — bağlantı `close` event'ine kadar açık kalır.
    return reply;
  });
}
