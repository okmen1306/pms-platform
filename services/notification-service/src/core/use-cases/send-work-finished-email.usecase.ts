import type { EmailTemplateRepository } from '../../infrastructure/database/email-template.repository';
import type { EmailAdapter } from '../../infrastructure/providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';
import type { ProjectServiceClient } from '../../infrastructure/external/project-service.client';
import type { WorkPackageCompletedEvent } from '@pms/shared';
import { sendTemplatedEmail } from './send-templated-email.usecase';

export const WORK_FINISHED_TEMPLATE_CODE = 'WORK_FINISHED';

/**
 * B3 (Day 8): "notification: bitiş e-postası + `work_package.completed` consumer" (roadmap.md
 * Bölüm 14.2 satır 8; dosya adı roadmap'in kendi dosya ağacında — Bölüm ~"Proje Yapısı" —
 * `send-work-finished-email.usecase.ts` olarak ZATEN belirlenmiş).
 *
 * NOT (send-work-assigned-email.usecase.ts'teki notla AYNI durum): `work_package.completed`
 * event'ini kimse HENÜZ yayınlamıyor — "bir iş paketinin TÜM alt görevleriyle tamamlanması"
 * akışı (project-service tarafı) ileri bir günün kapsamında (bkz.
 * mark-assignment-complete.usecase.ts Day 7 notu: o sadece TEK bir atamayı tamamlıyor, tüm iş
 * paketini değil). Tüketici, üreticiden önce hazır — projedeki yerleşik desen.
 *
 * Alıcı seçimi (isterler dosyasında bu event için ayrı bir madde metni bulunamadı — Uzman
 * İnisiyatifi, bkz. CHANGELOG.md Day 8): `send-delay-warning-email.usecase.ts`'teki "personel +
 * ekip lideri + şirket yönetimi" listesinden farklı olarak, BURADA şirket yönetimi
 * BİLGİLENDİRİLMEZ — tamamlanma rutin bir olaydır, üst yönetime yalnızca GECİKME (istisna)
 * durumunda haber verilir; bu asimetri delay-warning'in kendi yorumundaki mantıkla tutarlıdır.
 */
export async function sendWorkFinishedEmail(
  event: WorkPackageCompletedEvent,
  projectServiceClient: ProjectServiceClient,
  personnelClient: PersonnelServiceClient,
  templateRepo: EmailTemplateRepository,
  emailAdapter: EmailAdapter,
): Promise<void> {
  const [employee, teamLeadId] = await Promise.all([
    personnelClient.getEmployeeEmail(event.employeeId),
    projectServiceClient.getProjectTeamLeadId(event.projectId),
  ]);
  const teamLead = teamLeadId && teamLeadId !== event.employeeId ? await personnelClient.getEmployeeEmail(teamLeadId) : null;

  const context = {
    adSoyad: `${employee.ad} ${employee.soyad}`,
    tamamlanmaDurumu: event.onTime ? 'zamanında' : 'gecikmeli',
  };

  const recipients = new Set<string>([employee.email]);
  if (teamLead) recipients.add(teamLead.email);

  for (const to of recipients) {
    await sendTemplatedEmail(
      { templateCode: WORK_FINISHED_TEMPLATE_CODE, dil: 'tr', to, projectId: event.projectId, context },
      templateRepo,
      emailAdapter,
    );
  }
}
