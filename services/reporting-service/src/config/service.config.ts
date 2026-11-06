export const serviceConfig = {
  name: 'reporting-service',
  port: Number(process.env.PORT ?? 3010),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/9',
  // B1 (Day 12, "entegrasyon desteği — project tüketicileri"): work-detail raporunun iş paketi
  // adlarını çözmesi için.
  projectServiceUrl: process.env.PROJECT_SERVICE_URL ?? 'http://localhost:3003',
  // B3 (Day 12): malzeme maliyeti raporu ince bir REST proxy'dir — reporting-service KENDİ
  // finansal veri KOPYASINI TUTMAZ (Day 10'daki "basit takvim matematiği" kararıyla AYNI
  // felsefe: otoriter olması gereken bir hesaplama başka bir yerde tekrar edilmez).
  financeServiceUrl: process.env.FINANCE_SERVICE_URL ?? 'http://localhost:3006',
  // B2 (Day 13, "reporting tamamlamaya destek"): work-detail + workflow-status raporlarının
  // employeeId'lerini gerçek personel adlarına çözmesi için (bkz. personnel-service.client.ts).
  // Day 21 (B3): team-performance ince proxy'si.
  performanceServiceUrl: process.env.PERFORMANCE_SERVICE_URL ?? 'http://localhost:3007',
  personnelServiceUrl: process.env.PERSONNEL_SERVICE_URL ?? 'http://localhost:3002',
};
