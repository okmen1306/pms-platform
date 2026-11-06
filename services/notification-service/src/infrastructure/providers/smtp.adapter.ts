import nodemailer, { type Transporter } from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface EmailAdapter {
  send(input: SendEmailInput): Promise<void>;
}

/**
 * Day 4: Nodemailer entegrasyonu. Gerçek 5 e-posta türü (başlangıç/iş akışı/uyarı/bitiş/
 * proje tamamlandı — bkz. docs/roadmap.md "E-Posta ile Personel Bilgilendirmesi" bölümü)
 * Day 5'te (project-service event consumer'ları ile birlikte) eklenecek. Bugün sadece
 * transport katmanı ve şablon render'lama kuruluyor.
 */
export class NodemailerAdapter implements EmailAdapter {
  private readonly transporter: Transporter;

  constructor(smtpHost: string, smtpPort: number, smtpUser: string, smtpPass: string) {
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });
  }

  async send(input: SendEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: 'Proje Yönetim Sistemi <noreply@pms.local>',
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  }
}
