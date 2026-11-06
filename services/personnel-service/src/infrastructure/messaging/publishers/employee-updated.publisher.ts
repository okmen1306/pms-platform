import { RabbitMqClient, PERSONNEL_EVENTS, EmployeeUpdatedEventSchema, type EmployeeUpdatedEvent } from '@pms/shared';

/**
 * Day 15: `maas_tl` bu fonksiyona ASLA parametre olarak girmez (çağıran use-case'ler —
 * update-employee.usecase.ts VE deactivate-employee.usecase.ts — zaten şemaya uymayan bir alan
 * göndermez, ama `EmployeeUpdatedEventSchema.parse` yine de son bir güvenlik ağı).
 */
export function createEmployeeUpdatedPublisher(rabbit: RabbitMqClient) {
  return async (event: EmployeeUpdatedEvent): Promise<void> => {
    const parsed = EmployeeUpdatedEventSchema.parse(event);
    await rabbit.publish(PERSONNEL_EVENTS.EMPLOYEE_UPDATED, parsed);
  };
}
