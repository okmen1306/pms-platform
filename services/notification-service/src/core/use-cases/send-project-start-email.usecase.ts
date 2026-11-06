import type { EmailTemplateRepository } from '../../infrastructure/database/email-template.repository';
import type { EmailAdapter } from '../../infrastructure/providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';
import { sendTemplatedEmail } from './send-templated-email.usecase';

export const PROJECT_START_TEMPLATE_CODE = 'PROJECT_START';

/**
 * "E-Posta ile Personel Bilgilendirmesi" bölümü madde 1: "Projenin başlangıcında planlamaya
 * dahil edilmiş olan her personele ve şirket yöneticilerine projenin başladığını belirten bir
 * e-posta gönderilmelidir." Day 5'te henüz personel ataması yok (project-service ataması Day 7+),
 * bu yüzden şimdilik SADECE ekip liderine gönderiliyor; personel ataması eklenince (Day 7)
 * bu use-case genişletilecek — TODO aşağıda not edildi.
 */
export async function sendProjectStartEmail(
  event: { projectId: string; startDate: string; endDate: string; teamLeadId: string },
  templateRepo: EmailTemplateRepository,
  emailAdapter: EmailAdapter,
  personnelClient: PersonnelServiceClient,
): Promise<void> {
  const teamLead = await personnelClient.getEmployeeEmail(event.teamLeadId);

  await sendTemplatedEmail(
    {
      templateCode: PROJECT_START_TEMPLATE_CODE,
      dil: 'tr',
      to: teamLead.email,
      projectId: event.projectId,
      context: {
        adSoyad: `${teamLead.ad} ${teamLead.soyad}`,
        baslangicTarihi: event.startDate,
        bitisTarihi: event.endDate,
      },
    },
    templateRepo,
    emailAdapter,
  );

  // TODO (Day 7+, project-service personel ataması hazır olunca): projede görev alan TÜM
  // personele ve şirket yöneticilerine de aynı e-posta gönderilecek (madde 1'in tam kapsamı).
}
