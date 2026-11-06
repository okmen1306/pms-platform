import type { FastifyInstance } from 'fastify';
import { PERMISSION_KEYS } from '@pms/shared';
import { registerServiceProxy, attachActorHeaders, type GatewayPreHandler } from '../proxy/service-proxy';

/**
 * docs/roadmap.md dizin ağacı notu: "finance.routes.ts # yalnizca sirket_yoneticisi rolune acik".
 * Kural #8: "Maliyet analizi sayfalarını sadece Şirket Yöneticisi görebilir." Bu, rol adı yerine
 * `finance.cost_analysis` İZİN anahtarıyla uygulanıyor (roadmap'in RBAC modeliyle tutarlı —
 * rol değil, izin kontrol edilir).
 *
 * Q (Day 7 — risk notu): `013_seed_data.sql` şu an BOŞ (Supabase kurulumu bilinçli olarak
 * projenin sonuna bırakıldı, bkz. dosyanın kendi açıklaması). Yani `finance.cost_analysis` izni
 * HİÇBİR role henüz atanmamış — bu middleware doğru çalışır ama seed verisi girilene kadar
 * sirket_yoneticisi dahil KİMSE bu uç noktalara erişemez (`is_super_admin` hariç). Seed verisi
 * girilirken bu eşleşmenin unutulmaması gerekiyor.
 */
export async function registerFinanceRoutes(
  app: FastifyInstance,
  deps: {
    authenticate: GatewayPreHandler;
    requirePermissionByMethod: (key: string, opts?: { readOpen?: boolean }) => GatewayPreHandler;
    financeServiceUrl: string;
  },
) {
  await registerServiceProxy(app, {
    prefix: '/finance',
    upstream: deps.financeServiceUrl,
    // Day 20 (entegrasyon bulgusu): finance-service'in kendi rotaları `/finance/projects/:id/costs` —
    // varsayılan rewritePrefix '' ile `/finance/projects/..` upstream'e `/projects/..` giderdi (404).
    // Alternatif `/finance/finance/...` çift önekini istemciye yaptırmak yerine önek geri eklenir.
    rewritePrefix: '/finance',
    preHandler: [deps.authenticate, attachActorHeaders, deps.requirePermissionByMethod(PERMISSION_KEYS.FINANCE_COST_ANALYSIS)],
  });
}
