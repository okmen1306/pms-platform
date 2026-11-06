import { RabbitMqClient, PROJECT_EVENTS, ProjectCreatedEventSchema, queueName } from '@pms/shared';
import { sendProjectStartEmail } from '../../../core/use-cases/send-project-start-email.usecase';
import type { EmailTemplateRepository } from '../../database/email-template.repository';
import type { EmailAdapter } from '../../providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../external/personnel-service.client';

/**
 * docs/roadmap.md Bölüm 7 Kuyruk Haritası: project-service `project.created` yayınlar,
 * notification-service tüketip başlangıç e-postasını tetikler. Kuyruk adı kural gereği
 * "{servis}.{amaç}" formatında (bkz. shared/messaging/topology.ts).
 */
export async function registerProjectCreatedConsumer(
  rabbit: RabbitMqClient,
  deps: { templateRepo: EmailTemplateRepository; emailAdapter: EmailAdapter; personnelClient: PersonnelServiceClient },
) {
  await rabbit.subscribe(
    queueName('notification-service', 'project-created'),
    [PROJECT_EVENTS.CREATED],
    async (_routingKey, payload) => {
      const event = ProjectCreatedEventSchema.parse(payload);
      await sendProjectStartEmail(event, deps.templateRepo, deps.emailAdapter, deps.personnelClient);
    },
  );
}
