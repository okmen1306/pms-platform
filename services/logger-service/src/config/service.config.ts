export const serviceConfig = {
  name: 'logger-service',
  port: Number(process.env.PORT ?? 3011),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/10',
  // TL (Day 10): "Telegram adaptörü". Boş bırakılırsa telegram.adapter.ts sessizce atlar (log
  // route'lanır ama gönderilmez) — local/dev'de bot kurulmamış olabilir, servisin ayakta
  // kalmasını bloklamaz.
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
};
