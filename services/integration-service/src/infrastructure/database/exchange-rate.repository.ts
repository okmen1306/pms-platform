import type { SupabaseClient } from '@supabase/supabase-js';

/** Day 1'de tanımlanan arayüz. Day 2'de Supabase implementasyonu eklendi. */
export interface ExchangeRateRepository {
  upsertForDate(tarih: string, usdTry: number, kaynak: string): Promise<void>;
  findByDate(tarih: string): Promise<{ usdTry: number } | null>;
  findLatest(): Promise<{ tarih: string; usdTry: number } | null>;
}

export class SupabaseExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsertForDate(tarih: string, usdTry: number, kaynak: string): Promise<void> {
    const { error } = await this.db
      .from('integration_exchange_rates')
      .upsert({ tarih, usd_try: usdTry, kaynak }, { onConflict: 'tarih' });
    if (error) throw error;
  }

  async findByDate(tarih: string): Promise<{ usdTry: number } | null> {
    const { data, error } = await this.db
      .from('integration_exchange_rates')
      .select('usd_try')
      .eq('tarih', tarih)
      .maybeSingle();
    if (error) throw error;
    return data ? { usdTry: Number(data.usd_try) } : null;
  }

  async findLatest(): Promise<{ tarih: string; usdTry: number } | null> {
    const { data, error } = await this.db
      .from('integration_exchange_rates')
      .select('tarih, usd_try')
      .order('tarih', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? { tarih: data.tarih, usdTry: Number(data.usd_try) } : null;
  }
}
