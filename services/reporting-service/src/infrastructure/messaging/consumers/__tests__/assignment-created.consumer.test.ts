import { describe, it, expect, vi } from 'vitest';
import type { RabbitMqClient } from '@pms/shared';
import { ASSIGNMENT_EVENTS, queueName } from '@pms/shared';
import { registerAssignmentCreatedConsumer } from '../assignment-created.consumer';
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
  assignmentId: '11111111-1111-1111-1111-111111111111',
  projectId: '22222222-2222-2222-2222-222222222222',
  employeeId: '33333333-3333-3333-3333-333333333333',
  workPackageId: '44444444-4444-4444-4444-444444444444',
  start: '2026-02-01',
  end: '2026-02-14',
};

describe('registerAssignmentCreatedConsumer (B3, Day 13 — consumer doğrulaması)', () => {
  it('DOĞRU kuyruk adı ve routing key ile bağlanır (Kuyruk Haritası: reporting-service | assignment.created)', async () => {
    const { client, subscribeCalls } = fakeRabbit();
    await registerAssignmentCreatedConsumer(client, { reportRepo: {} as ReportRepository });

    expect(subscribeCalls).toHaveLength(1);
    expect(subscribeCalls[0].queue).toBe(queueName('reporting-service', 'assignment-created'));
    expect(subscribeCalls[0].routingKeys).toEqual([ASSIGNMENT_EVENTS.CREATED]);
  });

  it('GEÇERLİ payload: progress satırı %0 açılır VE planner snapshot VARSA workload haftaları yazılır', async () => {
    const upsertProgress = vi.fn(async () => {});
    const insertWorkloadSnapshot = vi.fn(async () => {});
    const findPlannerSnapshot = vi.fn(async () => ({ planlanan_baslangic: '2026-02-01' }));
    const reportRepo = { upsertProgress, insertWorkloadSnapshot, findPlannerSnapshot } as unknown as ReportRepository;
    const { client, subscribeCalls } = fakeRabbit();
    await registerAssignmentCreatedConsumer(client, { reportRepo });

    await subscribeCalls[0].onMessage(ASSIGNMENT_EVENTS.CREATED, VALID_PAYLOAD);

    expect(upsertProgress).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: VALID_PAYLOAD.projectId, employee_id: VALID_PAYLOAD.employeeId, tamamlanma_yuzdesi: 0 }),
    );
    expect(insertWorkloadSnapshot).toHaveBeenCalled();
  });

  it('planner snapshot henüz YOKSA (yarış durumu) progress satırı yine açılır ama workload YAZILMAZ', async () => {
    const upsertProgress = vi.fn(async () => {});
    const insertWorkloadSnapshot = vi.fn(async () => {});
    const findPlannerSnapshot = vi.fn(async () => null);
    const reportRepo = { upsertProgress, insertWorkloadSnapshot, findPlannerSnapshot } as unknown as ReportRepository;
    const { client, subscribeCalls } = fakeRabbit();
    await registerAssignmentCreatedConsumer(client, { reportRepo });

    await subscribeCalls[0].onMessage(ASSIGNMENT_EVENTS.CREATED, VALID_PAYLOAD);

    expect(upsertProgress).toHaveBeenCalled();
    expect(insertWorkloadSnapshot).not.toHaveBeenCalled();
  });

  it('ŞEMAYA UYMAYAN payload (geçersiz tarih formatı) onMessage içinde FIRLAR, repo\'ya HİÇ dokunulmaz', async () => {
    const upsertProgress = vi.fn();
    const reportRepo = { upsertProgress } as unknown as ReportRepository;
    const { client, subscribeCalls } = fakeRabbit();
    await registerAssignmentCreatedConsumer(client, { reportRepo });

    await expect(
      subscribeCalls[0].onMessage(ASSIGNMENT_EVENTS.CREATED, { ...VALID_PAYLOAD, start: 'gecersiz-tarih' }),
    ).rejects.toThrow();
    expect(upsertProgress).not.toHaveBeenCalled();
  });
});
