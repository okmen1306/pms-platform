import type { SupabaseClient } from '@supabase/supabase-js';

export interface EmailTemplateRow {
  id: string;
  kod: string;
  dil: 'tr' | 'en';
  konu: string;
  govde_html: string;
}

export interface EmailLogInput {
  alici_email: string;
  sablon_kodu: string;
  proje_id?: string | null;
  context?: Record<string, unknown>;
  durum: 'sent' | 'failed' | 'queued';
  hata_mesaji?: string | null;
}

export interface EmailTemplateRepository {
  findByCode(kod: string, dil: 'tr' | 'en'): Promise<EmailTemplateRow | null>;
  create(data: Omit<EmailTemplateRow, 'id'>): Promise<EmailTemplateRow>;
  logEmail(data: EmailLogInput): Promise<void>;
}

export class SupabaseEmailTemplateRepository implements EmailTemplateRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByCode(kod: string, dil: 'tr' | 'en'): Promise<EmailTemplateRow | null> {
    const { data, error } = await this.db
      .from('notification_email_templates')
      .select('*')
      .eq('kod', kod)
      .eq('dil', dil)
      .maybeSingle();
    if (error) throw error;
    return data as EmailTemplateRow | null;
  }

  async create(data: Omit<EmailTemplateRow, 'id'>): Promise<EmailTemplateRow> {
    const { data: row, error } = await this.db
      .from('notification_email_templates')
      .upsert(data, { onConflict: 'kod,dil' })
      .select('*')
      .single();
    if (error) throw error;
    return row as EmailTemplateRow;
  }

  async logEmail(data: EmailLogInput): Promise<void> {
    const { error } = await this.db.from('notification_email_log').insert(data);
    if (error) throw error;
  }
}
