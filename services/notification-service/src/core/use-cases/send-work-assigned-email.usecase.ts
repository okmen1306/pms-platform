import type { EmailTemplateRepository } from '../../infrastructure/database/email-template.repository';
import type { EmailAdapter } from '../../infrastructure/providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';
import { sendTemplatedEmail } from './send-templated-email.usecase';

export const WORK_ASSIGNED_TEMPLATE_CODE = 'WORK_ASSIGNED';

/**
 * "E-Posta ile Personel Bilgilendirmesi" madde 2: "Haftalık planlamaya göre sırası gelen
 * personele ilgili projede ilgili aşamaya başlamalısınız şeklinde e-posta gönderilmeli. Bu
 * e-postada personelin projedeki görevi ve bu görev için kaç gün süresi olduğu vurgulanmalı."
 *
 * NOT: project-service henüz personel atama endpoint'ine sahip değil (Day 7'de gelecek) — bu
 * yüzden bu use-case ve onu tetikleyecek consumer (assignment-created.consumer.ts) BUGÜN
 * yazılıyor ama Day 7'ye kadar hiçbir mesaj almayacak (publisher yok). Bu, roadmap'in kendi
 * planladığı sıra (bkz. docs/roadmap.md Bölüm 14.2 Day 6 satırı) — tüketici, üreticiden önce
 * hazır olabilir, tersi olamaz.
 */
export async function sendWorkAssignedEmail(
  event: { assignmentId: string; projectId: string; employeeId: string; workPackageId: string; start: string; end: string },
  templateRepo: EmailTemplateRepository,
  emailAdapter: EmailAdapter,
  personnelClient: PersonnelServiceClient,
): Promise<void> {
  const employee = await personnelClient.getEmployeeEmail(event.employeeId);

  const gunSayisi = Math.ceil(
    (new Date(event.end).getTime() - new Date(event.start).getTime()) / (24 * 60 * 60 * 1000),
  ) + 1;

  await sendTemplatedEmail(
    {
      templateCode: WORK_ASSIGNED_TEMPLATE_CODE,
      dil: 'tr',
      to: employee.email,
      projectId: event.projectId,
      context: {
        adSoyad: `${employee.ad} ${employee.soyad}`,
        baslangicTarihi: event.start,
        bitisTarihi: event.end,
        gunSayisi,
      },
    },
    templateRepo,
    emailAdapter,
  );
}
