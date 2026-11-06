import type { SupabaseClient } from '@supabase/supabase-js';

export interface ErrorEventRow {
  id: string;
  service: string;
  level: 'info' | 'warning' | 'error' | 'fatal';
  message: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateErrorEventRow {
  service: string;
  level: ErrorEventRow['level'];
  message: string;
  meta?: Record<string, unknown> | null;
}

/** TL (Day 10): `logger_error_events` (bkz. 014_logger_tables.sql — Day 9'da AUDIT ile birlikte oluşturuldu, bugüne kadar kullanılmıyordu). */
export interface ErrorEventRepository {
  insert(row: CreateErrorEventRow): Promise<ErrorEventRow>;
}

export class SupabaseErrorEventRepository implements ErrorEventRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(row: CreateErrorEventRow): Promise<ErrorEventRow> {
    const { data, error } = await this.db.from('logger_error_events').insert(row).select('*').single();
    if (error) throw error;
    return data as ErrorEventRow;
  }
}
