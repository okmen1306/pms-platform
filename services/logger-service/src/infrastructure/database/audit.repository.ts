import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditEventRow {
  id: string;
  service: string;
  event_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'PERMISSION_CHANGE' | 'VIEW_SENSITIVE';
  actor_user_id: string | null;
  actor_email: string | null;
  entity_type: string | null;
  entity_id: string | null;
  ozet: string;
  onceki_deger: Record<string, unknown> | null;
  yeni_deger: Record<string, unknown> | null;
  severity: 'info' | 'warning' | 'critical';
  ip_adresi: string | null;
  created_at: string;
}

export interface CreateAuditEventRow {
  service: string;
  event_type: AuditEventRow['event_type'];
  actor_user_id: string | null;
  actor_email: string | null;
  entity_type: string | null;
  entity_id: string | null;
  ozet: string;
  onceki_deger?: Record<string, unknown> | null;
  yeni_deger?: Record<string, unknown> | null;
  severity: AuditEventRow['severity'];
  ip_adresi?: string | null;
}

/**
 * TL (Day 9): "logger-service: audit tablo + `audit.event` consumer". `logger_audit_events`
 * DEĞİŞMEZDİR (append-only, bkz. docs/roadmap.md Bölüm 17.4 + 012_rls_policies.sql) — bu yüzden
 * bu sözleşmede KASITLI OLARAK `update`/`delete` metodu YOK, sadece `insert`/okuma metotları.
 *
 * TL (Day 11): "logger-service tamamlama". Okuma tarafı (filtrelenebilir/sayfalanmış liste,
 * `GET /admin/audit-log`) Day 9-10'da bilinçli olarak ertelenmişti — bugün eklendi (roadmap.md
 * satır ~1559'daki uç nokta imzasıyla BİREBİR: `service/entityType/actorUserId/severity/from/to/page`).
 */
export interface AuditEventFilters {
  service?: string;
  entityType?: string;
  actorUserId?: string;
  severity?: AuditEventRow['severity'];
  /** ISO tarih/zaman — created_at >= from */
  from?: string;
  /** ISO tarih/zaman — created_at <= to */
  to?: string;
}

export interface AuditEventListResult {
  items: AuditEventRow[];
  total: number;
}

/** Pulse özeti için yalnızca gereken sütunlar (ham JSON/özet metni çekilmez). */
export type AuditPulseRow = Pick<AuditEventRow, 'event_type' | 'severity' | 'actor_user_id' | 'created_at'>;

export interface AuditEventRepository {
  /** Day 22 (`system-pulse`): `since`'ten beri en fazla `limit` satır; fazlası varsa `truncated=true`. */
  findSince(since: string, limit: number): Promise<{ rows: AuditPulseRow[]; truncated: boolean }>;
  insert(row: CreateAuditEventRow): Promise<AuditEventRow>;
  list(filters: AuditEventFilters, pagination: { page: number; pageSize: number }): Promise<AuditEventListResult>;
  findById(id: string): Promise<AuditEventRow | null>;
}

export class SupabaseAuditEventRepository implements AuditEventRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(row: CreateAuditEventRow): Promise<AuditEventRow> {
    const { data, error } = await this.db.from('logger_audit_events').insert(row).select('*').single();
    if (error) throw error;
    return data as AuditEventRow;
  }

  async list(filters: AuditEventFilters, pagination: { page: number; pageSize: number }): Promise<AuditEventListResult> {
    let query = this.db.from('logger_audit_events').select('*', { count: 'exact' });
    if (filters.service) query = query.eq('service', filters.service);
    if (filters.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters.actorUserId) query = query.eq('actor_user_id', filters.actorUserId);
    if (filters.severity) query = query.eq('severity', filters.severity);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);

    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize - 1;
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(start, end);
    if (error) throw error;
    return { items: (data ?? []) as AuditEventRow[], total: count ?? 0 };
  }

  async findSince(since: string, limit: number): Promise<{ rows: AuditPulseRow[]; truncated: boolean }> {
    const { data, error } = await this.db
      .from('logger_audit_events')
      .select('event_type, severity, actor_user_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit + 1);
    if (error) throw error;
    const rows = (data ?? []) as AuditPulseRow[];
    return { rows: rows.slice(0, limit), truncated: rows.length > limit };
  }

  async findById(id: string): Promise<AuditEventRow | null> {
    const { data, error } = await this.db.from('logger_audit_events').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as AuditEventRow | null;
  }
}
