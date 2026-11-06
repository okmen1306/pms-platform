import { describe, it, expect, vi } from 'vitest';
import type { RabbitMqClient } from '@pms/shared';
import { PROJECT_EVENTS, queueName } from '@pms/shared';
import { registerProjectCreatedConsumer } from '../project-created.consumer';
import type { ReportRepository } from '../../../database/report.repository';

/**
 * B3 (Day 13): gerçek `RabbitMqClient.subscribe` (bkz. shared/messaging/rabbitmq.client.ts)
 * kuyruğu/binding'leri KURAR, sonra gelen her mesaj için `onMessage`'ı çağırır ve mesaj
 * `onMessage` içinde FIRLARSA (şema hatası dahil) requeue etmeden nack'ler (DLX'e düşer).
 * Bu fake, `subscribe` çağrısının ARGÜMANLARINI yakalar ki `onMessage`'ı gerçek RabbitMQ'ya
 * hiç dokunmadan, elle tetikleyip DAVRANIŞINI doğrulayabilelim — consumer registration
 * fonksiyonunun TEK sorumluluğu doğru kuyruk/routing key ile doğru handler'ı bağlamaktır;
 * ack/nack'in KENDİSİ RabbitMqClient'ın sorumluluğu, burada test edilmiyor.
 */
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
  startDate: '2026-01-01',
  endDate: '2026-06-01',
  teamLeadId: '22222222-2222-2222-2222-222222222222',
  projeAdi: 'Yeni Nesil Sensör Projesi',
  sureHafta: 20,
};

describe('registerProjectCreatedConsumer (B3, Day 13 — consumer doğrulaması)', () => {
  it('DOĞRU kuyruk adı ve routing key ile bağlanır (Kuyruk Haritası: reporting-service | project.created)', async () => {
    const { client, subscribeCalls } = fakeRabbit();
    await registerProjectCreatedConsumer(client, { reportRepo: {} as ReportRepository });

    expect(subscribeCalls).toHaveLength(1);
    expect(subscribeCalls[0].queue).toBe(queueName('reporting-service', 'project-created'));
    expect(subscribeCalls[0].routingKeys).toEqual([PROJECT_EVENTS.CREATED]);
  });

  it('GEÇERLİ bir payload geldiğinde upsertPlannerSnapshot doğru alanlarla çağrılır', async () => {
    const upsertPlannerSnapshot = vi.fn(async () => {});
    const reportRepo = { upsertPlannerSnapshot } as unknown as ReportRepository;
    const { client, subscribeCalls } = fakeRabbit();
    await registerProjectCreatedConsumer(client, { reportRepo });

    await subscribeCalls[0].onMessage(PROJECT_EVENTS.CREATED, VALID_PAYLOAD);

    expect(upsertPlannerSnapshot).toHaveBeenCalledWith({
      project_id: VALID_PAYLOAD.projectId,
      proje_adi: VALID_PAYLOAD.projeAdi,
      planlanan_baslangic: VALID_PAYLOAD.startDate,
      planlanan_sure_hafta: VALID_PAYLOAD.sureHafta,
    });
  });

  it('ŞEMAYA UYMAYAN payload (eksik projectId) onMessage içinde FIRLAR — RabbitMqClient bunu yakalayıp nack\'leyebilsin diye YUTULMAZ', async () => {
    const reportRepo = { upsertPlannerSnapshot: vi.fn() } as unknown as ReportRepository;
    const { client, subscribeCalls } = fakeRabbit();
    await registerProjectCreatedConsumer(client, { reportRepo });

    const withoutProjectId: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete withoutProjectId.projectId;
    await expect(subscribeCalls[0].onMessage(PROJECT_EVENTS.CREATED, withoutProjectId)).rejects.toThrow();
    expect(reportRepo.upsertPlannerSnapshot).not.toHaveBeenCalled();
  });

  it('projeAdi/sureHafta OPSİYONEL alanlar eksikse fallback ile devam eder (geriye dönük uyumluluk, bkz. project.events.ts)', async () => {
    const upsertPlannerSnapshot = vi.fn(async () => {});
    const reportRepo = { upsertPlannerSnapshot } as unknown as ReportRepository;
    const { client, subscribeCalls } = fakeRabbit();
    await registerProjectCreatedConsumer(client, { reportRepo });

    const minimalPayload: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete minimalPayload.projeAdi;
    delete minimalPayload.sureHafta;
    await subscribeCalls[0].onMessage(PROJECT_EVENTS.CREATED, minimalPayload);

    expect(upsertPlannerSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ proje_adi: 'Bilinmeyen Proje', planlanan_sure_hafta: null }),
    );
  });
});
