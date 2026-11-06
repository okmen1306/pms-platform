import 'dotenv/config';
import { buildApp } from './app';

const PORT = Number(process.env.PORT ?? 3006);

async function main() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`finance-service :${PORT} üzerinde ayakta`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('finance-service başlatılamadı:', err);
  process.exit(1);
});
