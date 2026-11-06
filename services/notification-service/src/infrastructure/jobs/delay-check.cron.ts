import cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import type { ScheduledJobRepository } from '../database/scheduled-job.repository';
import type { EmailTemplateRepository } from '../database/email-template.repository';
import type { EmailAdapter } from '../providers/smtp.adapter';
import type { PersonnelServiceClient } from '../external/personnel-service.client';
import type { ProjectServiceClient } from '../external/project-service.client';
import { DELAY_CHECK_JOB_TYPE } from '../messaging/consumers/assignment-created.consumer';
import { sendDelayWarningEmail } from '../../core/use-cases/send-delay-warning-email.usecase';

/**
 * "notification: gecikme cron'u" (docs/roadmap.md Bölüm 14.2, Day 7 satırı).
 *
 * KIRILMAZ KURAL gereği notification-service, project-service'in `project_personnel_assignments`
 * tablosunu hiç bilmez; gecikme TESPİTİ bu yüzden iki aşamalı: (1) her atama oluşturulduğunda
 * bitiş tarihinden bir gün sonrasına bir `notification_scheduled_jobs` satırı yazılır (bkz.
 * assignment-created.consumer.ts) — bu, "ne zaman kontrol edilmeli" bilgisidir; (2) bu cron her
 * gün bu tabloyu tarar VE her iş için project-service'e tek satırlık bir REST çağrısıyla
 * ("hâlâ tamamlanmadı mı?") günceli doğrular ÖNCE e-posta göndermeden. Bu iki adımlı tasarım,
 * event kataloğundaki `work_package.delayed` event'ini YENİDEN YAYINLAMAZ (bkz.
 * send-delay-warning-email.usecase.ts başlığı) — notification zaten tek tüketici olduğundan
 * REST doğrulaması yeterli ve daha basit (Uzman İnisiyatifi, over-engineering'den kaçınma).
 *
 * DELAY_CHECK_CRON env değişkeniyle ayarlanabilir (varsayılan: her gün 08:00).
 */
export function scheduleDelayCheck(
  deps: {
    scheduledJobRepo: ScheduledJobRepository;
    templateRepo: EmailTemplateRepository;
    emailAdapter: EmailAdapter;
    personnelClient: PersonnelServiceClient;
    projectClient: ProjectServiceClient;
    companyManagementEmail: string;
  },
  cronExpr: string,
  logger: FastifyBaseLogger,
) {
  cron.schedule(cronExpr, () => runDelayCheckOnce(deps, logger));
}

export async function runDelayCheckOnce(
  deps: {
    scheduledJobRepo: ScheduledJobRepository;
    templateRepo: EmailTemplateRepository;
    emailAdapter: EmailAdapter;
    personnelClient: PersonnelServiceClient;
    projectClient: ProjectServiceClient;
    companyManagementEmail: string;
  },
  logger: FastifyBaseLogger,
): Promise<void> {
  const dueJobs = await deps.scheduledJobRepo.findDueJobs(DELAY_CHECK_JOB_TYPE, new Date().toISOString());

  for (const job of dueJobs) {
    try {
      const result = await sendDelayWarningEmail(
        job.ilgili_kayit_id,
        deps.projectClient,
        deps.personnelClient,
        deps.templateRepo,
        deps.emailAdapter,
        deps.companyManagementEmail,
      );
      if (result.sent || result.reason === 'ALREADY_COMPLETED') {
        // Görev tamamlanmışsa da iş "bitmiş" sayılır — her gün tekrar kontrol etmeye gerek yok.
        await deps.scheduledJobRepo.markDone(job.id);
      }
      // reason === 'NOT_YET_LATE' ise İŞARETLENMEZ, bir sonraki cron çalışmasında tekrar denenir.
    } catch (err) {
      logger.error({ err, jobId: job.id }, 'Gecikme uyarı e-postası gönderilemedi');
    }
  }
}
