export const serviceConfig = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me',
  identityServiceUrl: process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:3001',
  personnelServiceUrl: process.env.PERSONNEL_SERVICE_URL ?? 'http://localhost:3002',
  projectServiceUrl: process.env.PROJECT_SERVICE_URL ?? 'http://localhost:3003',
  procurementServiceUrl: process.env.PROCUREMENT_SERVICE_URL ?? 'http://localhost:3004',
  integrationServiceUrl: process.env.INTEGRATION_SERVICE_URL ?? 'http://localhost:3005',
  financeServiceUrl: process.env.FINANCE_SERVICE_URL ?? 'http://localhost:3006',
  performanceServiceUrl: process.env.PERFORMANCE_SERVICE_URL ?? 'http://localhost:3007',
  riskServiceUrl: process.env.RISK_SERVICE_URL ?? 'http://localhost:3008',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3009',
  reportingServiceUrl: process.env.REPORTING_SERVICE_URL ?? 'http://localhost:3010',
  loggerServiceUrl: process.env.LOGGER_SERVICE_URL ?? 'http://localhost:3011',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/15',
  // Day 18 (entegrasyon hatası): `origin: true` (her origin'i yansıt) + refresh cookie'si için
  // gereken `credentials: true` birlikte kullanılırsa HERHANGİ bir site kimlik bilgili istek
  // atıp yanıtı okuyabilirdi — bu yüzden açık bir izin listesi (virgülle ayrılmış).
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
};
