export const serviceConfig = {
  name: 'notification-service',
  port: Number(process.env.PORT ?? 3009),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/8',
  personnelServiceUrl: process.env.PERSONNEL_SERVICE_URL ?? 'http://localhost:3002',
  projectServiceUrl: process.env.PROJECT_SERVICE_URL ?? 'http://localhost:3003',
  /**
   * Day 7 — Uzman İnisiyatifi: "şirket yönetimi" gecikme uyarısı e-postasının hedefi. Roadmap
   * bunu tek tek super-admin kullanıcılarını identity-service'ten çekerek mi, yoksa sabit bir
   * yönetim dağıtım adresine mi göndereceğini belirtmiyor. notification-service'e üçüncü bir
   * dış servis bağımlılığı (identity-service) eklememek için BİLİNÇLİ olarak sabit bir dağıtım
   * adresi kullanıldı — birçok gerçek sistemde de "management@..." gibi bir DL bu şekilde kullanılır.
   * TODO (ileri gün): identity-service'ten dinamik super-admin listesi çekmeye geçilebilir.
   */
  companyManagementEmail: process.env.COMPANY_MANAGEMENT_EMAIL ?? 'yonetim@example.com',
  delayCheckCron: process.env.DELAY_CHECK_CRON ?? '0 8 * * *',
  smtpHost: process.env.SMTP_HOST ?? 'localhost',
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
};
