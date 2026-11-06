/** Fastify request'ine api-gateway tarafından enjekte edilen kimlik bağlamı */
export interface RequestActor {
  userId: string;
  email: string;
  roleId: string;
  roleKod: string;
  isSuperAdmin: boolean;
  personnelId: string | null;
  dilTercihi: 'tr' | 'en';
}

/** Her serviste health-check endpoint'inin dönmesi gereken standart şekil */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: string;
  uptimeSeconds: number;
  dependencies: {
    database: 'ok' | 'error';
    rabbitmq: 'ok' | 'error';
    redis?: 'ok' | 'error';
  };
}
