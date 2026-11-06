import 'dotenv/config';
import { buildApp } from './app';

const PORT = Number(process.env.PORT ?? 3011);

async function main() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`logger-service :${PORT} üzerinde ayakta`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('logger-service başlatılamadı:', err);
  process.exit(1);
});
