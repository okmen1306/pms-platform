export const serviceConfig = {
  name: 'procurement-service',
  port: Number(process.env.PORT ?? 3004),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/3',
  integrationServiceUrl: process.env.INTEGRATION_SERVICE_URL ?? 'http://localhost:3005',
};
