import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ASSIGNMENT_EVENTS, queueName, type RabbitMqClient } from '@pms/shared';
import { createConnectedClient, purgeQueue, waitFor } from './_helpers';

import { registerAssignmentCreatedConsumer as registerNotificationConsumer } from '../../services/notification-service/src/infrastructure/messaging/consumers/assignment-created.consumer';
import type { EmailTemplateRepository, EmailTemplateRow } from '../../services/notification-service/src/infrastructure/database/email-template.repository';
import type { EmailAdapter } from '../../services/notification-service/src/infrastructure/providers/smtp.adapter';
import type { PersonnelServiceClient as NotificationPersonnelClient } from '../../services/notification-service/src/infrastructure/external/personnel-service.client';
import type { ScheduledJobRepository } from '../../services/notification-service/src/infrastructure/database/scheduled-job.repository';

import { registerAssignmentCreatedConsumer as registerReportingConsumer } from '../../services/reporting-service/src/infrastructure/messaging/consumers/assignment-created.consumer';
import type { ReportRepository } from '../../services/reporting-service/src/infrastructure/database/report.repository';

/**
 * Day 14: Kuyruk Haritası'nın `assignment.created` satırı — tabloda notification-service ve
 * reporting-service listelenir. NOT: finance-service'in de (Day 7, AR-GE maliyeti için) BU
 * event'i tükettiği kod okumasıyla doğrulandı ama gerçek-broker testi bugün buraya DAHİL
 * EDİLMEDİ — 2 REST istemcisine (integration-service, personnel-service) bağımlı derinliği
 * nedeniyle (bkz. docs/testing/event-integration-audit.md, "kapsam dışı bırakılanlar").
 */
describe('assignment.created → notification-service + reporting-service (GERÇEK broker)', () => {
  let rabbit: RabbitMqClient;

  const event = {
    assignmentId: randomUUID(),
    projectId: randomUUID(),
    employeeId: randomUUID(),
    workPackageId: randomUUID(),
    start: '2026-04-01',
    end: '2026-04-14',
  };

  beforeAll(async () => {
    await purgeQueue(queueName('notification-service', 'assignment-created'));
    await purgeQueue(queueName('reporting-service', 'assignment-created'));
    rabbit = await createConnectedClient();
  });

  afterAll(async () => {
    await rabbit.close();
  });

  it('notification-service: iş akışı e-postası GÖNDERİLİR VE gecikme kontrolü (Day 7 delay-check) ZAMANLANIR', async () => {
    const sentEmails: { to: string }[] = [];
    const scheduledJobs: { jobTipi: string; ilgiliKayitId: string }[] = [];
    const template: EmailTemplateRow = { id: 't-2', kod: 'WORK_ASSIGNED', dil: 'tr', konu: 'Yeni Görev', govde_html: '<p>{{workPackageId}}</p>' };
    const templateRepo: EmailTemplateRepository = { findByCode: async () => template, create: async () => template, logEmail: async () => {} };
    const emailAdapter: EmailAdapter = { send: async (input) => void sentEmails.push(input) };
    const personnelClient = { getEmployeeEmail: async () => ({ email: 'personel@acme.test', ad: 'Mehmet', soyad: 'Demir' }) } as unknown as NotificationPersonnelClient;
    const scheduledJobRepo: ScheduledJobRepository = {
      schedule: async (jobTipi, ilgiliKayitId) => void scheduledJobs.push({ jobTipi, ilgiliKayitId }),
      findDueJobs: async () => [],
      markDone: async () => {},
    };

    await registerNotificationConsumer(rabbit, { templateRepo, emailAdapter, personnelClient, scheduledJobRepo });
    await rabbit.publish(ASSIGNMENT_EVENTS.CREATED, event);

    await waitFor(() => sentEmails.length > 0 && scheduledJobs.length > 0);
    expect(sentEmails[0].to).toBe('personel@acme.test');
    expect(scheduledJobs[0]).toMatchObject({ jobTipi: 'DELAY_CHECK', ilgiliKayitId: event.assignmentId });
  });

  it('reporting-service: gerçek broker üzerinden teslim alınır, progress satırı %0 AÇILIR', async () => {
    const progressCalls: unknown[] = [];
    const reportRepo = {
      upsertProgress: async (row: unknown) => void progressCalls.push(row),
      insertWorkloadSnapshot: async () => {},
      findPlannerSnapshot: async () => null,
    } as unknown as ReportRepository;

    await registerReportingConsumer(rabbit, { reportRepo });
    await rabbit.publish(ASSIGNMENT_EVENTS.CREATED, event);

    await waitFor(() => progressCalls.length > 0);
    expect(progressCalls[0]).toMatchObject({ project_id: event.projectId, employee_id: event.employeeId, tamamlanma_yuzdesi: 0 });
  });
});
