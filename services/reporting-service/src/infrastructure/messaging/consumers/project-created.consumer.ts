import { RabbitMqClient, PROJECT_EVENTS, ProjectCreatedEventSchema, queueName } from '@pms/shared';
import type { ReportRepository } from '../../database/report.repository';
import { recordProjectPlannerSnapshot } from '../../../core/use-cases/record-project-planner-snapshot.usecase';

export async function registerProjectCreatedConsumer(rabbit: RabbitMqClient, deps: { reportRepo: ReportRepository }) {
  await rabbit.subscribe(queueName('reporting-service', 'project-created'), [PROJECT_EVENTS.CREATED], async (_routingKey, payload) => {
    const event = ProjectCreatedEventSchema.parse(payload);
    await recordProjectPlannerSnapshot(event, deps.reportRepo);
  });
}
