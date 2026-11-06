import { RabbitMqClient, ASSIGNMENT_EVENTS, AssignmentCreatedEventSchema, queueName } from '@pms/shared';
import type { ReportRepository } from '../../database/report.repository';
import { recordAssignmentWorkload } from '../../../core/use-cases/record-assignment-workload.usecase';

export async function registerAssignmentCreatedConsumer(rabbit: RabbitMqClient, deps: { reportRepo: ReportRepository }) {
  await rabbit.subscribe(queueName('reporting-service', 'assignment-created'), [ASSIGNMENT_EVENTS.CREATED], async (_routingKey, payload) => {
    const event = AssignmentCreatedEventSchema.parse(payload);
    await recordAssignmentWorkload(event, deps.reportRepo);
  });
}
