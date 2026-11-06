import { describe, it, expect, beforeEach } from 'vitest';
import { sendWorkFinishedEmail } from '../send-work-finished-email.usecase';
import type { EmailTemplateRepository, EmailTemplateRow, EmailLogInput } from '../../../infrastructure/database/email-template.repository';
import type { EmailAdapter, SendEmailInput } from '../../../infrastructure/providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../../infrastructure/external/personnel-service.client';
import type { ProjectServiceClient } from '../../../infrastructure/external/project-service.client';
import type { WorkPackageCompletedEvent } from '@pms/shared';

const EMPLOYEE_ID = '11111111-1111-1111-1111-111111111111';
const TEAM_LEAD_ID = '22222222-2222-2222-2222-222222222222';
const PROJECT_ID = '33333333-3333-3333-3333-333333333333';

const template: EmailTemplateRow = {
  id: 't-1',
  kod: 'WORK_FINISHED',
  dil: 'tr',
  konu: 'İş paketiniz {{tamamlanmaDurumu}} tamamlandı',
  govde_html: 'Merhaba {{adSoyad}}, göreviniz {{tamamlanmaDurumu}} tamamlandı.',
};

class FakeTemplateRepo implements EmailTemplateRepository {
  logs: EmailLogInput[] = [];
  async findByCode(): Promise<EmailTemplateRow | null> {
    return template;
  }
  async create(): Promise<EmailTemplateRow> {
    return template;
  }
  async logEmail(data: EmailLogInput): Promise<void> {
    this.logs.push(data);
  }
}

class FakeEmailAdapter implements EmailAdapter {
  sent: SendEmailInput[] = [];
  async send(input: SendEmailInput): Promise<void> {
    this.sent.push(input);
  }
}

function fakePersonnelClient(withTeamLead = true): PersonnelServiceClient {
  return {
    getEmployeeEmail: async (id: string) => {
      if (id === EMPLOYEE_ID) return { email: 'calisan@example.com', ad: 'Ayşe', soyad: 'Yılmaz' };
      if (id === TEAM_LEAD_ID) return { email: 'lider@example.com', ad: 'Mehmet', soyad: 'Demir' };
      throw new Error('bilinmeyen personel');
    },
  } as unknown as PersonnelServiceClient;
}

function fakeProjectClient(teamLeadId: string | null): ProjectServiceClient {
  return {
    getProjectTeamLeadId: async () => teamLeadId,
  } as unknown as ProjectServiceClient;
}

function makeEvent(overrides: Partial<WorkPackageCompletedEvent> = {}): WorkPackageCompletedEvent {
  return {
    projectId: PROJECT_ID,
    workPackageId: '44444444-4444-4444-4444-444444444444',
    subWorkPackageId: null,
    employeeId: EMPLOYEE_ID,
    onTime: true,
    ...overrides,
  };
}

describe('sendWorkFinishedEmail', () => {
  let templateRepo: FakeTemplateRepo;
  let emailAdapter: FakeEmailAdapter;

  beforeEach(() => {
    templateRepo = new FakeTemplateRepo();
    emailAdapter = new FakeEmailAdapter();
  });

  it('ekip lideri VARSA hem çalışana hem lidere gönderir', async () => {
    await sendWorkFinishedEmail(makeEvent(), fakeProjectClient(TEAM_LEAD_ID), fakePersonnelClient(), templateRepo, emailAdapter);
    const recipients = emailAdapter.sent.map((s) => s.to).sort();
    expect(recipients).toEqual(['calisan@example.com', 'lider@example.com']);
  });

  it('ekip lideri YOKSA sadece çalışana gönderir', async () => {
    await sendWorkFinishedEmail(makeEvent(), fakeProjectClient(null), fakePersonnelClient(), templateRepo, emailAdapter);
    expect(emailAdapter.sent).toHaveLength(1);
    expect(emailAdapter.sent[0].to).toBe('calisan@example.com');
  });

  it('ekip lideri KENDİSİYSE (kendi görevini tamamlayan kişi aynı zamanda lider) MÜKERRER e-posta gitmez', async () => {
    await sendWorkFinishedEmail(makeEvent(), fakeProjectClient(EMPLOYEE_ID), fakePersonnelClient(), templateRepo, emailAdapter);
    expect(emailAdapter.sent).toHaveLength(1);
  });

  it('onTime:false ise şablon bağlamında "gecikmeli" geçer', async () => {
    await sendWorkFinishedEmail(makeEvent({ onTime: false }), fakeProjectClient(null), fakePersonnelClient(), templateRepo, emailAdapter);
    expect(emailAdapter.sent[0].html).toContain('gecikmeli tamamlandı');
  });

  it('onTime:true ise şablon bağlamında "zamanında" geçer', async () => {
    await sendWorkFinishedEmail(makeEvent({ onTime: true }), fakeProjectClient(null), fakePersonnelClient(), templateRepo, emailAdapter);
    expect(emailAdapter.sent[0].html).toContain('zamanında tamamlandı');
  });

  it('her gönderim notification_email_log\'a "sent" olarak kaydedilir', async () => {
    await sendWorkFinishedEmail(makeEvent(), fakeProjectClient(TEAM_LEAD_ID), fakePersonnelClient(), templateRepo, emailAdapter);
    expect(templateRepo.logs).toHaveLength(2);
    expect(templateRepo.logs.every((l) => l.durum === 'sent')).toBe(true);
  });
});
