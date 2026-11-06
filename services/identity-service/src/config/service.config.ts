export const serviceConfig = {
  name: 'identity-service',
  port: Number(process.env.PORT ?? 3001),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://admin:secret@localhost:5672',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
  // JWT_SECRET: gateway ve identity-service AYNI secreti paylaşmalı (Day 6-8'de api-gateway
  // JWT_PUBLIC_KEY/JWT_SECRET ile bu tokenları doğrulayacak).
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
  // Day 18 (entegrasyon hatası): refresh cookie'sinin `Path`'i, TARAYICININ gördüğü yola göre
  // ayarlanmak ZORUNDA. Tarayıcı identity-service'e doğrudan değil api-gateway üzerinden
  // (`/identity/auth/refresh`) gidiyor; cookie `Path=/auth` olarak set edilirse tarayıcı onu bu
  // isteğe HİÇ göndermez (cookie path eşleşmesi önek bazlı: `/identity/auth/...` `/auth`
  // ile başlamıyor) — refresh akışı sessizce, her seferinde 401 ile bozuk çalışırdı.
  refreshCookiePath: process.env.REFRESH_COOKIE_PATH ?? '/identity/auth',
  cookieSecure: (process.env.NODE_ENV ?? 'development') === 'production',
};
