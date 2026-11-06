import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Day 1: temel Vite iskeleti. api-gateway proxy ayarı, backend hazır olunca (Day 18+
// entegrasyon haftası) eklenecek.
// Q (Day 10): `test.environment: 'jsdom'` eklendi — ilk React Testing Library testi
// (AuthContext + usePermission, bkz. usePermission.test.tsx) DOM API'lerine ihtiyaç duyuyor;
// vitest'in varsayılanı ('node') bunları sağlamıyordu.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: { environment: 'jsdom' },
});
