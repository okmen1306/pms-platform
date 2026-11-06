import { RabbitMqClient, PROJECT_EVENTS, ProjectCompletedEventSchema, queueName } from '@pms/shared';
import { sendProjectCompletedEmail } from '../../../core/use-cases/send-project-completed-email.usecase';
import type { EmailTemplateRepository } from '../../database/email-template.repository';
import type { EmailAdapter } from '../../providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../external/personnel-service.client';
import type { ProjectServiceClient } from '../../external/project-service.client';

export async function registerProjectCompletedConsumer(
  rabbit: RabbitMqClient,
  deps: {
    templateRepo: EmailTemplateRepository;
    emailAdapter: EmailAdapter;
    personnelClient: PersonnelServiceClient;
    projectClient: ProjectServiceClient;
    companyManagementEmail: string;
  },
) {
  await rabbit.subscribe(queueName('notification-service', 'project-completed'), [PROJECT_EVENTS.COMPLETED], async (_routingKey, payload) => {
    const event = ProjectCompletedEventSchema.parse(payload);
    await sendProjectCompletedEmail(event, deps.projectClient, deps.personnelClient, deps.templateRepo, deps.emailAdapter, deps.companyManagementEmail);
  });
}
