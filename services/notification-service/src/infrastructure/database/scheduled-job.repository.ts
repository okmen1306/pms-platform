import type { SupabaseClient } from '@supabase/supabase-js';

export interface ScheduledJobRow {
  id: string;
  job_tipi: string;
  ilgili_kayit_id: string;
  calisacagi_zaman: string;
  calisti_mi: boolean;
}

export interface ScheduledJobRepository {
  schedule(jobTipi: string, ilgiliKayitId: string, calisacagiZaman: string): Promise<void>;
  findDueJobs(jobTipi: string, now: string): Promise<ScheduledJobRow[]>;
  markDone(id: string): Promise<void>;
}

/**
 * `notification_scheduled_jobs` (bkz. 009_notification_tables.sql, Day 4'te tasarlanmış ama
 * Day 7'ye kadar hiç kullanılmamış bir tablo). Day 7'de gecikme cron'u için ilk kez kullanılıyor:
 * bir atama oluşturulduğunda `DELAY_CHECK` tipinde, bitiş tarihinden bir gün sonrasına planlanmış
 * bir "iş" kaydedilir; cron her gün bu tabloyu tarar (bkz. delay-check.cron.ts).
 */
export class SupabaseScheduledJobRepository implements ScheduledJobRepository {
  constructor(private readonly db: SupabaseClient) {}

  async schedule(jobTipi: string, ilgiliKayitId: string, calisacagiZaman: string): Promise<void> {
    const { error } = await this.db.from('notification_scheduled_jobs').insert({
      job_tipi: jobTipi,
      ilgili_kayit_id: ilgiliKayitId,
      calisacagi_zaman: calisacagiZaman,
    });
    if (error) throw error;
  }

  async findDueJobs(jobTipi: string, now: string): Promise<ScheduledJobRow[]> {
    const { data, error } = await this.db
      .from('notification_scheduled_jobs')
      .select('*')
      .eq('job_tipi', jobTipi)
      .eq('calisti_mi', false)
      .lte('calisacagi_zaman', now);
    if (error) throw error;
    return (data ?? []) as ScheduledJobRow[];
  }

  async markDone(id: string): Promise<void> {
    const { error } = await this.db.from('notification_scheduled_jobs').update({ calisti_mi: true }).eq('id', id);
    if (error) throw error;
  }
}
