export const serviceConfig = {
  name: 'performance-service',
  port: Number(process.env.PORT ?? 3007),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/6',
};
