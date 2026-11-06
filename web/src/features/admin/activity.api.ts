import { apiFetch } from '../../shared/api';

/** Gateway: `/logger/*` → `admin.audit_log` (logger-service'in `/admin/...` uçları). */
export interface SystemPulse {
  generatedAt: string;
  todayStart: string;
  todayActions: number;
  activeUsersToday: number;
  last24h: { created: number; deleted: number; warnings: number; permissionChanges: number };
  /** `null` = veri kaynağı yok (0 DEĞİL, G-27). */
  delayedWorkPackages: number | null;
  truncated: boolean;
}

export type Severity = 'info' | 'warning' | 'critical';

/** UI'nın tek biçimi (SSE camelCase, audit-log snake_case → buna normalize edilir). */
export interface ActivityItem {
  id: string;
  service: string;
  eventType: string;
  actorUserId: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ozet: string;
  severity: Severity;
  createdAt: string;
}

/** E-posta yoksa: kullanıcı kimliği varsa kısaltılmış kimlik, hiç yoksa gerçekten sistem işlemi. */
export const actorLabel = (i: Pick<ActivityItem, 'actorEmail' | 'actorUserId'>): string =>
  i.actorEmail ?? (i.actorUserId ? `kullanıcı ${i.actorUserId.slice(0, 8)}` : 'sistem');

export interface AuditDetail extends ActivityItem {
  oncekiDeger: Record<string, unknown> | null;
  yeniDeger: Record<string, unknown> | null;
}

interface AuditRow {
  id: string;
  service: string;
  event_type: string;
  actor_user_id: string | null;
  actor_email: string | null;
  entity_type: string | null;
  entity_id: string | null;
  ozet: string;
  onceki_deger: Record<string, unknown> | null;
  yeni_deger: Record<string, unknown> | null;
  severity: Severity;
  created_at: string;
}

export const fromAuditRow = (r: AuditRow): AuditDetail => ({
  id: r.id,
  service: r.service,
  eventType: r.event_type,
  actorUserId: r.actor_user_id ?? null,
  actorEmail: r.actor_email,
  entityType: r.entity_type,
  entityId: r.entity_id,
  ozet: r.ozet,
  severity: r.severity,
  createdAt: r.created_at,
  oncekiDeger: r.onceki_deger,
  yeniDeger: r.yeni_deger,
});

export function fetchSystemPulse(): Promise<SystemPulse> {
  return apiFetch<SystemPulse>('/logger/admin/system-pulse', { fallbackError: 'Sistem nabzı alınamadı' });
}

export async function fetchAuditSince(fromIso: string, pageSize = 100): Promise<ActivityItem[]> {
  const rows = await apiFetch<AuditRow[]>(`/logger/admin/audit-log?from=${encodeURIComponent(fromIso)}&pageSize=${pageSize}`, {
    fallbackError: 'Aktivite geçmişi alınamadı',
  });
  return rows.map(fromAuditRow);
}

export async function fetchAuditDetail(id: string): Promise<AuditDetail> {
  return fromAuditRow(await apiFetch<AuditRow>(`/logger/admin/audit-log/${id}`, { fallbackError: 'Denetim kaydı alınamadı' }));
}
