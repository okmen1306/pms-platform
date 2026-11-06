import { describe, it, expect, beforeEach } from 'vitest';
import { sendProjectCompletedEmail } from '../send-project-completed-email.usecase';
import type { EmailTemplateRepository, EmailTemplateRow, EmailLogInput } from '../../../infrastructure/database/email-template.repository';
import type { EmailAdapter, SendEmailInput } from '../../../infrastructure/providers/smtp.adapter';
import type { PersonnelServiceClient } from '../../../infrastructure/external/personnel-service.client';
import type { ProjectServiceClient } from '../../../infrastructure/external/project-service.client';
import type { ProjectCompletedEvent } from '@pms/shared';

const PROJECT_ID = '33333333-3333-3333-3333-333333333333';
const TEAM_LEAD_ID = '22222222-2222-2222-2222-222222222222';
const EMPLOYEE_A_ID = '11111111-1111-1111-1111-111111111111';
const EMPLOYEE_B_ID = '44444444-4444-4444-4444-444444444444';
const COMPANY_MANAGEMENT_EMAIL = 'yonetim@example.com';

const template: EmailTemplateRow = {
  id: 't-1',
  kod: 'PROJECT_COMPLETED',
  dil: 'tr',
  konu: '{{projeAdi}} tamamlandı',
  govde_html: '{{projeAdi}} projesi {{tamamlanmaTarihi}} tarihinde tamamlandı.',
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

const EMAILS: Record<string, { email: string; ad: string; soyad: string }> = {
  [TEAM_LEAD_ID]: { email: 'lider@example.com', ad: 'Mehmet', soyad: 'Demir' },
  [EMPLOYEE_A_ID]: { email: 'ayse@example.com', ad: 'Ayşe', soyad: 'Yılmaz' },
  [EMPLOYEE_B_ID]: { email: 'can@example.com', ad: 'Can', soyad: 'Öz' },
};

function fakePersonnelClient(): PersonnelServiceClient {
  return {
    getEmployeeEmail: async (id: string) => {
      const found = EMAILS[id];
      if (!found) throw new Error('bilinmeyen personel');
      return found;
    },
  } as unknown as PersonnelServiceClient;
}

function fakeProjectClient(employeeIds: string[]): ProjectServiceClient {
  return {
    getProject: async () => ({ projeAdi: 'Elektronik Kart Tasarımı', ekipLideriId: TEAM_LEAD_ID }),
    getProjectEmployeeIds: async () => employeeIds,
  } as unknown as ProjectServiceClient;
}

function makeEvent(overrides: Partial<ProjectCompletedEvent> = {}): ProjectCompletedEvent {
  return { projectId: PROJECT_ID, completedAt: '2026-09-10', ...overrides };
}

describe('sendProjectCompletedEmail', () => {
  let templateRepo: FakeTemplateRepo;
  let emailAdapter: FakeEmailAdapter;

  beforeEach(() => {
    templateRepo = new FakeTemplateRepo();
    emailAdapter = new FakeEmailAdapter();
  });

  it('projede görev alan HERKESE + ekip liderine + şirket yönetimine gönderir', async () => {
    await sendProjectCompletedEmail(
      makeEvent(),
      fakeProjectClient([EMPLOYEE_A_ID, EMPLOYEE_B_ID]),
      fakePersonnelClient(),
      templateRepo,
      emailAdapter,
      COMPANY_MANAGEMENT_EMAIL,
    );
    const recipients = emailAdapter.sent.map((s) => s.to).sort();
    expect(recipients).toEqual(['ayse@example.com', 'can@example.com', 'lider@example.com', 'yonetim@example.com'].sort());
  });

  it('AYNI kişi hem çalışan hem ekip lideriyse MÜKERRER e-posta gitmez', async () => {
    await sendProjectCompletedEmail(
      makeEvent(),
      fakeProjectClient([TEAM_LEAD_ID, EMPLOYEE_A_ID]),
      fakePersonnelClient(),
      templateRepo,
      emailAdapter,
      COMPANY_MANAGEMENT_EMAIL,
    );
    const recipients = emailAdapter.sent.map((s) => s.to);
    expect(new Set(recipients).size).toBe(recipients.length); // tekrar yok
    expect(recipients).toContain('lider@example.com');
  });

  it('projede hiç atama yoksa bile ekip liderine + şirket yönetimine gönderir', async () => {
    await sendProjectCompletedEmail(makeEvent(), fakeProjectClient([]), fakePersonnelClient(), templateRepo, emailAdapter, COMPANY_MANAGEMENT_EMAIL);
    const recipients = emailAdapter.sent.map((s) => s.to).sort();
    expect(recipients).toEqual(['lider@example.com', 'yonetim@example.com'].sort());
  });

  it('e-posta bağlamında proje adı ve tamamlanma tarihi geçer', async () => {
    await sendProjectCompletedEmail(
      makeEvent({ completedAt: '2026-12-01' }),
      fakeProjectClient([]),
      fakePersonnelClient(),
      templateRepo,
      emailAdapter,
      COMPANY_MANAGEMENT_EMAIL,
    );
    expect(emailAdapter.sent[0].html).toContain('Elektronik Kart Tasarımı');
    expect(emailAdapter.sent[0].html).toContain('2026-12-01');
  });

  it('her gönderim notification_email_log\'a "sent" olarak kaydedilir', async () => {
    await sendProjectCompletedEmail(
      makeEvent(),
      fakeProjectClient([EMPLOYEE_A_ID]),
      fakePersonnelClient(),
      templateRepo,
      emailAdapter,
      COMPANY_MANAGEMENT_EMAIL,
    );
    expect(templateRepo.logs).toHaveLength(3); // çalışan + lider + yönetim
    expect(templateRepo.logs.every((l) => l.durum === 'sent')).toBe(true);
  });
});
