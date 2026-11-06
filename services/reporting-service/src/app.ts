import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import type { HealthCheckResponse } from '@pms/shared';
import { registerErrorHandler, RabbitMqClient } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { SupabaseReportRepository } from './infrastructure/database/report.repository';
import { registerProjectCreatedConsumer } from './infrastructure/messaging/consumers/project-created.consumer';
import { registerAssignmentCreatedConsumer } from './infrastructure/messaging/consumers/assignment-created.consumer';
import { registerWorkPackageCompletedConsumer } from './infrastructure/messaging/consumers/work-package-completed.consumer';
import { registerCompletionReportRoutes } from './api/completion-report.controller';
import { registerWorkflowReportRoutes } from './api/workflow-report.controller';
import { registerProjectPlannerRoutes } from './api/project-planner.controller';
import { registerWorkDetailRoutes } from './api/work-detail.controller';
import { registerMaterialCostReportRoutes } from './api/material-cost-report.controller';
import { ProjectServiceClient } from './infrastructure/external/project-service.client';
import { PerformanceServiceClient } from './infrastructure/external/performance-service.client';
import { registerTeamPerformanceReportRoutes } from './api/team-performance-report.controller';
import { FinanceServiceClient } from './infrastructure/external/finance-service.client';
import { PersonnelServiceClient } from './infrastructure/external/personnel-service.client';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();

  const reportRepo = new SupabaseReportRepository(db);
  await registerProjectCreatedConsumer(rabbit, { reportRepo });
  await registerAssignmentCreatedConsumer(rabbit, { reportRepo });
  await registerWorkPackageCompletedConsumer(rabbit, { reportRepo });
  /**
   * B3 (Day 13, "reporting-service tamamlama + tüm consumer doğrulaması"): docs/roadmap.md
   * Bölüm 7 Kuyruk Haritası, reporting-service için 5 event listeler: yukarıdaki 3'ü (test
   * edildi, bkz. consumers/__tests__/) + `material.purchased` + `performance.score_submitted`.
   * Bu ikisi BİLİNÇLİ olarak consumer'sız:
   *  - `material.purchased`: Day 12'de malzeme-maliyeti raporu finance-service'e İNCE BİR PROXY
   *    olarak tasarlandı (bkz. material-cost-report.controller.ts) — reporting-service kendi
   *    finansal veri KOPYASINI TUTMAZ, bu yüzden bu olayı tüketmesine gerek yok.
   *  - `performance.score_submitted`: şeması `@pms/shared`'da TANIMLI (bkz.
   *    shared/events/performance.events.ts) ama performance-service'in `scoreEmployee`/
   *    `scoreTeamLead` use-case'leri bunu HENÜZ YAYINLAMIYOR — kod içindeki TODO bunu açıkça
   *    Day 33+'a bırakıyor. Üreteci olmayan bir olay için tüketici eklemek (Day 6'daki
   *    "tüketici üreticiden önce hazır" desenin TERSİ) test edilemez bir kod parçası bırakır;
   *    üretici geldiğinde (Day 33+) tüketici de O GÜN eklenecek.
   */

  registerCompletionReportRoutes(app, { reportRepo });

  // B3 (Day 12, B1 destekli) + B1+B2 (Day 13, "reporting tamamlamaya destek"): workflow/
  // malzeme-maliyeti/planlayıcı/iş-detay uç noktaları. `personnelServiceClient` bugün eklendi —
  // workflow-status ve work-detail artık employeeId'leri de gerçek adlara çözüyor (bkz. ilgili
  // usecase dosyalarındaki Day 13 notları).
  const projectServiceClient = new ProjectServiceClient(serviceConfig.projectServiceUrl);
  const financeServiceClient = new FinanceServiceClient(serviceConfig.financeServiceUrl);
  const personnelServiceClient = new PersonnelServiceClient(serviceConfig.personnelServiceUrl);
  registerWorkflowReportRoutes(app, { reportRepo, projectServiceClient, personnelServiceClient });
  registerProjectPlannerRoutes(app, { reportRepo });
  registerWorkDetailRoutes(app, { reportRepo, projectServiceClient, personnelServiceClient });
  registerMaterialCostReportRoutes(app, { financeServiceClient });
  registerTeamPerformanceReportRoutes(app, { performanceServiceClient: new PerformanceServiceClient(serviceConfig.performanceServiceUrl) });

  app.get('/health', async (): Promise<HealthCheckResponse> => {
    return {
      status: 'ok',
      service: 'reporting-service',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      dependencies: {
        database: 'ok',
        rabbitmq: 'ok',
      },
    };
  });

  app.addHook('onClose', async () => {
    await rabbit.close();
  });

  return app;
}
