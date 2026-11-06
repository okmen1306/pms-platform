export const serviceConfig = {
  name: 'personnel-service',
  port: Number(process.env.PORT ?? 3002),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672',
  projectServiceUrl: process.env.PROJECT_SERVICE_URL ?? 'http://localhost:3003',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/1',
};
