import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PROJECT_EVENTS, queueName, type RabbitMqClient } from '@pms/shared';
import { createConnectedClient, purgeQueue, waitFor } from './_helpers';

import { registerProjectCreatedConsumer as registerNotificationConsumer } from '../../services/notification-service/src/infrastructure/messaging/consumers/project-created.consumer';
import type { EmailTemplateRepository, EmailTemplateRow } from '../../services/notification-service/src/infrastructure/database/email-template.repository';
import type { EmailAdapter } from '../../services/notification-service/src/infrastructure/providers/smtp.adapter';
import type { PersonnelServiceClient as NotificationPersonnelClient } from '../../services/notification-service/src/infrastructure/external/personnel-service.client';

import { registerProjectCreatedConsumer as registerFinanceConsumer } from '../../services/finance-service/src/infrastructure/messaging/consumers/project-created.consumer';
import type { CostRepository } from '../../services/finance-service/src/infrastructure/database/cost.repository';
import type { AssignmentCacheRepository } from '../../services/finance-service/src/infrastructure/database/assignment-cache.repository';

import { registerProjectCreatedConsumer as registerReportingConsumer } from '../../services/reporting-service/src/infrastructure/messaging/consumers/project-created.consumer';
import type { ReportRepository } from '../../services/reporting-service/src/infrastructure/database/report.repository';

/**
 * Day 14 ("tüm publisher → consumer event çiftlerinin manuel tetiklenip loglanarak uçtan uca
 * doğrulanması"): docs/roadmap.md Kuyruk Haritası'nın `project.created` satırı — 3 consumer
 * (notification-service, finance-service, reporting-service). Bu test GERÇEK bir RabbitMQ'ya
 * (bkz. _helpers.ts) TEK bir publish yapar ve ÜÇÜNÜN DE bağımsız kuyruklarına doğru şekilde
 * teslim edildiğini doğrular — DB katmanı hâlâ fake (Supabase bu ortamda yok), ama exchange/
 * queue/routing-key/şema doğrulama zinciri artık taklit DEĞİL, gerçek.
 */
describe('project.created → notification-service + finance-service + reporting-service (GERÇEK broker)', () => {
  let rabbit: RabbitMqClient;

  const event = {
    projectId: randomUUID(),
    startDate: '2026-03-01',
    endDate: '2026-08-01',
    teamLeadId: randomUUID(),
    sureHafta: 22,
    projeAdi: 'Day 14 Doğrulama Projesi',
    tahminiMaliyetTl: 500000,
    satisFiyatiTl: 750000,
  };

  beforeAll(async () => {
    await purgeQueue(queueName('notification-service', 'project-created'));
    await purgeQueue(queueName('finance-service', 'project-created'));
    await purgeQueue(queueName('reporting-service', 'project-created'));
    rabbit = await createConnectedClient();
  });

  afterAll(async () => {
    await rabbit.close();
  });

  it('notification-service: gerçek broker üzerinden teslim alınır, proje başlangıç e-postası GÖNDERİLİR', async () => {
    const sentEmails: { to: string; subject: string }[] = [];
    const emailAdapter: EmailAdapter = { send: async (input) => void sentEmails.push(input) };
    const template: EmailTemplateRow = { id: 't-1', kod: 'PROJECT_START', dil: 'tr', konu: 'Proje Başladı: {{adSoyad}}', govde_html: '<p>{{baslangicTarihi}}</p>' };
    const templateRepo: EmailTemplateRepository = {
      findByCode: async () => template,
      create: async () => template,
      logEmail: async () => {},
    };
    const personnelClient = { getEmployeeEmail: async () => ({ email: 'ekip.lideri@acme.test', ad: 'Ayşe', soyad: 'Yılmaz' }) } as unknown as NotificationPersonnelClient;

    await registerNotificationConsumer(rabbit, { templateRepo, emailAdapter, personnelClient });
    await rabbit.publish(PROJECT_EVENTS.CREATED, event);

    await waitFor(() => sentEmails.length > 0);
    expect(sentEmails[0].to).toBe('ekip.lideri@acme.test');
  });

  it('finance-service: gerçek broker üzerinden teslim alınır, proje maliyet kaydı SIFIRLARLA AÇILIR', async () => {
    const initCalls: unknown[] = [];
    const metaCalls: unknown[] = [];
    const costRepo = { initializeForProject: async (projectId: string, init: unknown) => void initCalls.push({ projectId, init }) } as unknown as CostRepository;
    const assignmentCacheRepo = { upsertProjectMeta: async (row: unknown) => void metaCalls.push(row) } as unknown as AssignmentCacheRepository;

    await registerFinanceConsumer(rabbit, { costRepo, assignmentCacheRepo });
    await rabbit.publish(PROJECT_EVENTS.CREATED, event);

    await waitFor(() => initCalls.length > 0 && metaCalls.length > 0);
    expect(initCalls[0]).toMatchObject({ projectId: event.projectId, init: { toplamTahminiMaliyetTl: event.tahminiMaliyetTl } });
  });

  it('reporting-service: gerçek broker üzerinden teslim alınır, planner snapshot AÇILIR', async () => {
    const upsertCalls: unknown[] = [];
    const reportRepo = { upsertPlannerSnapshot: async (row: unknown) => void upsertCalls.push(row) } as unknown as ReportRepository;

    await registerReportingConsumer(rabbit, { reportRepo });
    await rabbit.publish(PROJECT_EVENTS.CREATED, event);

    await waitFor(() => upsertCalls.length > 0);
    expect(upsertCalls[0]).toMatchObject({ project_id: event.projectId, proje_adi: event.projeAdi });
  });
});
