import type { EmailTemplateRepository } from '../../infrastructure/database/email-template.repository';
import type { EmailAdapter } from '../../infrastructure/providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';
import type { ProjectServiceClient } from '../../infrastructure/external/project-service.client';
import { sendTemplatedEmail } from './send-templated-email.usecase';

export const DELAY_WARNING_TEMPLATE_CODE = 'DELAY_WARNING';

/**
 * Event kataloğu (docs/roadmap.md): `work_package.delayed { projectId, workPackageId,
 * employeeId, daysLate }` -> notification-service (uyarı e-postası -> personel, ekip lideri,
 * proje yöneticisi, şirket yönetimi). "Proje yöneticisi" bu sistemde `ekip_lideri_id` alanına
 * karşılık geliyor (bkz. project_projects şeması, roadmap.md Bölüm 4.4).
 *
 * Bu, delay-check.cron.ts tarafından çağrılır ve project-service'in tablosuna hiç dokunmaz —
 * sadece iki salt-okunur REST çağrısıyla (assignment + proje) güncel durumu doğrular.
 */
export async function sendDelayWarningEmail(
  assignmentId: string,
  projectServiceClient: ProjectServiceClient,
  personnelClient: PersonnelServiceClient,
  templateRepo: EmailTemplateRepository,
  emailAdapter: EmailAdapter,
  companyManagementEmail: string,
): Promise<{ sent: boolean; reason?: string }> {
  const assignment = await projectServiceClient.getAssignment(assignmentId);

  if (assignment.tamamlandiMi) {
    return { sent: false, reason: 'ALREADY_COMPLETED' };
  }

  const daysLate = Math.max(
    0,
    Math.floor((Date.now() - new Date(assignment.bitisTarihi).getTime()) / (24 * 60 * 60 * 1000)),
  );
  if (daysLate <= 0) {
    // Yarış durumu: iş henüz gerçekten gecikmemiş (job erken tetiklendi) — sessizce atla.
    return { sent: false, reason: 'NOT_YET_LATE' };
  }

  const [employee, teamLeadId] = await Promise.all([
    personnelClient.getEmployeeEmail(assignment.employeeId),
    projectServiceClient.getProjectTeamLeadId(assignment.projectId),
  ]);
  const teamLead = teamLeadId ? await personnelClient.getEmployeeEmail(teamLeadId) : null;

  const context = {
    adSoyad: `${employee.ad} ${employee.soyad}`,
    bitisTarihi: assignment.bitisTarihi,
    gecikmeGunSayisi: daysLate,
  };

  const recipients = new Set<string>([employee.email, companyManagementEmail]);
  if (teamLead) recipients.add(teamLead.email);

  for (const to of recipients) {
    await sendTemplatedEmail(
      { templateCode: DELAY_WARNING_TEMPLATE_CODE, dil: 'tr', to, projectId: assignment.projectId, context },
      templateRepo,
      emailAdapter,
    );
  }

  return { sent: true };
}
