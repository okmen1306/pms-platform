import { RabbitMqClient, ASSIGNMENT_EVENTS, AssignmentCreatedEventSchema, queueName } from '@pms/shared';
import { sendWorkAssignedEmail } from '../../../core/use-cases/send-work-assigned-email.usecase';
import type { EmailTemplateRepository } from '../../database/email-template.repository';
import type { EmailAdapter } from '../../providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../external/personnel-service.client';
import type { ScheduledJobRepository } from '../../database/scheduled-job.repository';

export const DELAY_CHECK_JOB_TYPE = 'DELAY_CHECK';

export async function registerAssignmentCreatedConsumer(
  rabbit: RabbitMqClient,
  deps: {
    templateRepo: EmailTemplateRepository;
    emailAdapter: EmailAdapter;
    personnelClient: PersonnelServiceClient;
    scheduledJobRepo: ScheduledJobRepository;
  },
) {
  await rabbit.subscribe(
    queueName('notification-service', 'assignment-created'),
    [ASSIGNMENT_EVENTS.CREATED],
    async (_routingKey, payload) => {
      const event = AssignmentCreatedEventSchema.parse(payload);
      await sendWorkAssignedEmail(event, deps.templateRepo, deps.emailAdapter, deps.personnelClient);

      // Day 7: gecikme cron'u (delay-check.cron.ts) bu işi bitiş tarihinden BİR GÜN SONRA
      // (gecikmenin kesinleşmesi için asgari süre) devralacak — bkz. o dosyadaki KIRILMAZ KURAL notu.
      const dueAt = new Date(`${event.end}T00:00:00Z`);
      dueAt.setUTCDate(dueAt.getUTCDate() + 1);
      await deps.scheduledJobRepo.schedule(DELAY_CHECK_JOB_TYPE, event.assignmentId, dueAt.toISOString());
    },
  );
}
