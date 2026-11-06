export const serviceConfig = {
  name: 'finance-service',
  port: Number(process.env.PORT ?? 3006),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/5',
  integrationServiceUrl: process.env.INTEGRATION_SERVICE_URL ?? 'http://localhost:3005',
  personnelServiceUrl: process.env.PERSONNEL_SERVICE_URL ?? 'http://localhost:3002',
};
