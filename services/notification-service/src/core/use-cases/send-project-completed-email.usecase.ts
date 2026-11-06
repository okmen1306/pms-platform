import type { EmailTemplateRepository } from '../../infrastructure/database/email-template.repository';
import type { EmailAdapter } from '../../infrastructure/providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';
import type { ProjectServiceClient } from '../../infrastructure/external/project-service.client';
import type { ProjectCompletedEvent } from '@pms/shared';
import { sendTemplatedEmail } from './send-templated-email.usecase';

export const PROJECT_COMPLETED_TEMPLATE_CODE = 'PROJECT_COMPLETED';

/**
 * B3 (Day 9): "notification: proje tamamlanma e-postası + saga akışı" (docs/roadmap.md Bölüm
 * 14.2 satır 9). "Sipariş/Proje Tamamlanma Saga Akışı"nın (Bölüm 7.x) 5. adımı:
 *
 *   5. notification-service tüm projede görev almış personele ve yöneticilere
 *      "PROJECT_COMPLETED" şablonuyla e-posta gönderir
 *
 * Saga'nın diğer adımları (1-4: project-service'in TÜM ana iş paketleri tamamlanınca
 * `project.completed` yayınlaması; 6: finance-service'in son maliyeti kilitlemesi) BUGÜNÜN
 * kapsamında DEĞİL — project-service'in Day 9 satırı "milestone / zaman çizelgesi", finance'in
 * Day 9 satırı "idari maliyet + kâr marjı" (bugün ayrıca tamamlandı). Tüketici, üreticiden önce
 * hazır — Day 6/8'deki AYNI desen (bkz. send-work-assigned-email.usecase.ts, send-work-finished-
 * email.usecase.ts notları).
 *
 * `smtp.adapter.ts`'in Day 4 yorumunda sayılan "5 gerçek e-posta türü"nün (başlangıç/iş akışı/
 * uyarı/bitiş/proje tamamlandı) SONUNCUSU — notification-service'in planlanan e-posta seti
 * bugün itibarıyla TAMAMLANDI.
 *
 * Alıcılar (Uzman İnisiyatifi — "ve yöneticilere" isterler metninde netleştirilmemiş): ekip
 * lideri + şirket yönetimi, `send-delay-warning-email.usecase.ts`'teki İLE AYNI "yönetici"
 * yorumuyla tutarlı (proje tamamlanması, gecikme kadar üst yönetimin bilmesi gereken önemli bir
 * olay — send-work-finished-email.usecase.ts'in TERSİNE, o rutin bir tamamlanmaydı, bu projenin
 * BÜTÜNÜNÜN tamamlanmasıdır).
 */
export async function sendProjectCompletedEmail(
  event: ProjectCompletedEvent,
  projectServiceClient: ProjectServiceClient,
  personnelClient: PersonnelServiceClient,
  templateRepo: EmailTemplateRepository,
  emailAdapter: EmailAdapter,
  companyManagementEmail: string,
): Promise<void> {
  const [project, employeeIds] = await Promise.all([
    projectServiceClient.getProject(event.projectId),
    projectServiceClient.getProjectEmployeeIds(event.projectId),
  ]);

  const employees = await Promise.all(employeeIds.map((id) => personnelClient.getEmployeeEmail(id)));
  const teamLead = await personnelClient.getEmployeeEmail(project.ekipLideriId);

  const context = {
    projeAdi: project.projeAdi,
    tamamlanmaTarihi: event.completedAt,
  };

  const recipients = new Set<string>([teamLead.email, companyManagementEmail, ...employees.map((e) => e.email)]);

  for (const to of recipients) {
    await sendTemplatedEmail(
      { templateCode: PROJECT_COMPLETED_TEMPLATE_CODE, dil: 'tr', to, projectId: event.projectId, context },
      templateRepo,
      emailAdapter,
    );
  }
}
