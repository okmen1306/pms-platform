export const serviceConfig = {
  name: 'integration-service',
  port: Number(process.env.PORT ?? 3005),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/4',
  tcmbXmlUrl: process.env.TCMB_KUR_XML_URL ?? 'https://www.tcmb.gov.tr/kurlar/today.xml',
  rateFetchCron: process.env.RATE_FETCH_CRON ?? '0 16 * * *',
};
