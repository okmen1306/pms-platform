import { RabbitMqClient, PROJECT_EVENTS, WorkPackageCompletedEventSchema, queueName } from '@pms/shared';
import type { ReportRepository } from '../../database/report.repository';
import { recordWorkPackageProgress } from '../../../core/use-cases/record-work-package-progress.usecase';

export async function registerWorkPackageCompletedConsumer(rabbit: RabbitMqClient, deps: { reportRepo: ReportRepository }) {
  await rabbit.subscribe(queueName('reporting-service', 'work-package-completed'), [PROJECT_EVENTS.WORK_PACKAGE_COMPLETED], async (_routingKey, payload) => {
    const event = WorkPackageCompletedEventSchema.parse(payload);
    await recordWorkPackageProgress(event, deps.reportRepo);
  });
}
