import type { AuditEventRepository } from '../../infrastructure/database/audit.repository';

export interface SystemPulse {
  generatedAt: string;
  /** "Bugün" = Europe/Istanbul takvim günü (UTC+3, DST yok). */
  todayStart: string;
  todayActions: number;
  /** Bugün en az bir işlem yapan farklı kullanıcı sayısı (sistem işlemleri — actor yok — sayılmaz). */
  activeUsersToday: number;
  last24h: { created: number; deleted: number; warnings: number; permissionChanges: number };
  /**
   * Geciken iş paketi sayısı project-service'e aittir (kırılmaz kural: servisler arası DB erişimi yok) ve
   * henüz bir uç noktası/çağrısı yok → her zaman `null`. UI "veri yok" gösterir, 0 DEĞİL (G-27).
   */
  delayedWorkPackages: null;
  /** Satır sınırı aşıldıysa sayılar alt sınırdır (kesilmiş). */
  truncated: boolean;
}

const PULSE_ROW_LIMIT = 20000;
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** `now`'ın Istanbul takvim gününün başlangıcı (UTC ISO). */
export function istanbulDayStart(now: Date): Date {
  const shifted = new Date(now.getTime() + TR_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - TR_OFFSET_MS);
}

/**
 * `GET /admin/system-pulse`: yalnızca logger-service'in KENDİ verisi (`logger_audit_events`) üzerinden
 * hesaplanır. Bugün + son 24 saati kapsayacak kadar geriden (ikisinden eskisi) tek sorgu çekilir.
 */
export async function computeSystemPulse(repo: AuditEventRepository, now: Date = new Date()): Promise<SystemPulse> {
  const todayStart = istanbulDayStart(now);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since = todayStart < dayAgo ? todayStart : dayAgo;
  const { rows, truncated } = await repo.findSince(since.toISOString(), PULSE_ROW_LIMIT);

  const todayActors = new Set<string>();
  let todayActions = 0;
  const last24h = { created: 0, deleted: 0, warnings: 0, permissionChanges: 0 };
  for (const r of rows) {
    const at = new Date(r.created_at);
    if (at >= todayStart) {
      todayActions++;
      if (r.actor_user_id) todayActors.add(r.actor_user_id);
    }
    if (at >= dayAgo) {
      if (r.event_type === 'CREATE') last24h.created++;
      if (r.event_type === 'DELETE') last24h.deleted++;
      if (r.severity === 'warning' || r.severity === 'critical') last24h.warnings++;
      if (r.event_type === 'PERMISSION_CHANGE') last24h.permissionChanges++;
    }
  }
  return {
    generatedAt: now.toISOString(),
    todayStart: todayStart.toISOString(),
    todayActions,
    activeUsersToday: todayActors.size,
    last24h,
    delayedWorkPackages: null,
    truncated,
  };
}
