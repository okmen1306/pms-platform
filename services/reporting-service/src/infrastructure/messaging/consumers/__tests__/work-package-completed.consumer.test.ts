import { describe, it, expect, vi } from 'vitest';
import type { RabbitMqClient } from '@pms/shared';
import { PROJECT_EVENTS, queueName } from '@pms/shared';
import { registerWorkPackageCompletedConsumer } from '../work-package-completed.consumer';
import type { ReportRepository } from '../../../database/report.repository';

function fakeRabbit() {
  const subscribeCalls: { queue: string; routingKeys: string[]; onMessage: (routingKey: string, payload: unknown) => Promise<void> }[] = [];
  const client = {
    subscribe: vi.fn(async (queue: string, routingKeys: string[], onMessage: (routingKey: string, payload: unknown) => Promise<void>) => {
      subscribeCalls.push({ queue, routingKeys, onMessage });
    }),
  } as unknown as RabbitMqClient;
  return { client, subscribeCalls };
}

const VALID_PAYLOAD = {
  projectId: '11111111-1111-1111-1111-111111111111',
  workPackageId: '22222222-2222-2222-2222-222222222222',
  subWorkPackageId: null,
  employeeId: '33333333-3333-3333-3333-333333333333',
  onTime: true,
};

describe('registerWorkPackageCompletedConsumer (B3, Day 13 — consumer doğrulaması)', () => {
  it('DOĞRU kuyruk adı ve routing key ile bağlanır (Kuyruk Haritası: reporting-service | work_package.completed)', async () => {
    const { client, subscribeCalls } = fakeRabbit();
    await registerWorkPackageCompletedConsumer(client, { reportRepo: {} as ReportRepository });

    expect(subscribeCalls).toHaveLength(1);
    expect(subscribeCalls[0].queue).toBe(queueName('reporting-service', 'work-package-completed'));
    expect(subscribeCalls[0].routingKeys).toEqual([PROJECT_EVENTS.WORK_PACKAGE_COMPLETED]);
  });

  it('GEÇERLİ payload: progress %100\'e çekilir VE proje geneli tamamlanma yeniden hesaplanır (Day 11 düzeltmesi)', async () => {
    const upsertProgress = vi.fn(async () => {});
    const listProgressByProject = vi.fn(async () => [{ tamamlanma_yuzdesi: 100 }, { tamamlanma_yuzdesi: 0 }]);
    const updatePlannerCompletion = vi.fn(async () => {});
    const reportRepo = { upsertProgress, listProgressByProject, updatePlannerCompletion } as unknown as ReportRepository;
    const { client, subscribeCalls } = fakeRabbit();
    await registerWorkPackageCompletedConsumer(client, { reportRepo });

    await subscribeCalls[0].onMessage(PROJECT_EVENTS.WORK_PACKAGE_COMPLETED, VALID_PAYLOAD);

    expect(upsertProgress).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: VALID_PAYLOAD.projectId, work_package_id: VALID_PAYLOAD.workPackageId, tamamlanma_yuzdesi: 100 }),
    );
    expect(updatePlannerCompletion).toHaveBeenCalledWith(VALID_PAYLOAD.projectId, 50);
  });

  it('ŞEMAYA UYMAYAN payload (employeeId eksik) onMessage içinde FIRLAR, repo\'ya HİÇ dokunulmaz', async () => {
    const upsertProgress = vi.fn();
    const reportRepo = { upsertProgress } as unknown as ReportRepository;
    const { client, subscribeCalls } = fakeRabbit();
    await registerWorkPackageCompletedConsumer(client, { reportRepo });

    const withoutEmployeeId: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete withoutEmployeeId.employeeId;
    await expect(subscribeCalls[0].onMessage(PROJECT_EVENTS.WORK_PACKAGE_COMPLETED, withoutEmployeeId)).rejects.toThrow();
    expect(upsertProgress).not.toHaveBeenCalled();
  });
});
