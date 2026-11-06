import { RabbitMqClient, PROJECT_EVENTS, WorkPackageCompletedEventSchema, queueName } from '@pms/shared';
import { sendWorkFinishedEmail } from '../../../core/use-cases/send-work-finished-email.usecase';
import type { EmailTemplateRepository } from '../../database/email-template.repository';
import type { EmailAdapter } from '../../providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../external/personnel-service.client';
import type { ProjectServiceClient } from '../../external/project-service.client';

export async function registerWorkPackageCompletedConsumer(
  rabbit: RabbitMqClient,
  deps: {
    templateRepo: EmailTemplateRepository;
    emailAdapter: EmailAdapter;
    personnelClient: PersonnelServiceClient;
    projectClient: ProjectServiceClient;
  },
) {
  await rabbit.subscribe(
    queueName('notification-service', 'work-package-completed'),
    [PROJECT_EVENTS.WORK_PACKAGE_COMPLETED],
    async (_routingKey, payload) => {
      const event = WorkPackageCompletedEventSchema.parse(payload);
      await sendWorkFinishedEmail(event, deps.projectClient, deps.personnelClient, deps.templateRepo, deps.emailAdapter);
    },
  );
}
