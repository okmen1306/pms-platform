import type { EmailAdapter } from '../../infrastructure/providers/smtp.adapter';
import type { EmailTemplateRepository } from '../../infrastructure/database/email-template.repository';

/** Basit {{degisken}} interpolasyonu — Day 5+'te 5 gerçek şablon (başlangıç/iş akışı/uyarı/
 * bitiş/proje tamamlandı) bu fonksiyonu kullanacak. */
function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(context[key] ?? ''));
}

export interface SendTemplatedEmailInput {
  templateCode: string;
  dil: 'tr' | 'en';
  to: string;
  context: Record<string, unknown>;
  projectId?: string;
}

/**
 * TÜM e-posta gönderimlerinin ortak giriş noktası (Bölüm "E-Posta ile Personel
 * Bilgilendirmesi"). Şablon bulunamazsa veya SMTP hatası olursa `notification_email_log`'a
 * "failed" olarak kaydedilir — sessizce yutulmaz, admin aktivite akışında görünür hale gelir
 * (bkz. logger-service audit consumer, ilerleyen günlerde bağlanacak).
 */
export async function sendTemplatedEmail(
  input: SendTemplatedEmailInput,
  templateRepo: EmailTemplateRepository,
  emailAdapter: EmailAdapter,
): Promise<void> {
  const template = await templateRepo.findByCode(input.templateCode, input.dil);
  if (!template) {
    await templateRepo.logEmail({
      alici_email: input.to,
      sablon_kodu: input.templateCode,
      proje_id: input.projectId ?? null,
      context: input.context,
      durum: 'failed',
      hata_mesaji: `Şablon bulunamadı: ${input.templateCode} (${input.dil})`,
    });
    return;
  }

  try {
    await emailAdapter.send({
      to: input.to,
      subject: renderTemplate(template.konu, input.context),
      html: renderTemplate(template.govde_html, input.context),
    });
    await templateRepo.logEmail({
      alici_email: input.to,
      sablon_kodu: input.templateCode,
      proje_id: input.projectId ?? null,
      context: input.context,
      durum: 'sent',
    });
  } catch (err) {
    await templateRepo.logEmail({
      alici_email: input.to,
      sablon_kodu: input.templateCode,
      proje_id: input.projectId ?? null,
      context: input.context,
      durum: 'failed',
      hata_mesaji: err instanceof Error ? err.message : 'Bilinmeyen SMTP hatası',
    });
  }
}
