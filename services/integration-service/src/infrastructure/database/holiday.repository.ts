import type { SupabaseClient } from '@supabase/supabase-js';

export interface HolidayRow {
  id: string;
  tarih: string;
  aciklama: string;
  yil: number;
  yarim_gun: boolean;
}

export interface CreateHolidayInput {
  tarih: string;
  aciklama: string;
  yarimGun?: boolean;
}

/** Day 1'de tanımlanan arayüz; Day 2'de findByYear/isHoliday, Day 3'te create tamamlandı. */
export interface HolidayRepository {
  findByYear(yil: number): Promise<HolidayRow[]>;
  create(data: CreateHolidayInput): Promise<HolidayRow>;
  isHoliday(tarih: string): Promise<boolean>;
}

export class SupabaseHolidayRepository implements HolidayRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByYear(yil: number): Promise<HolidayRow[]> {
    const { data, error } = await this.db
      .from('integration_public_holidays')
      .select('*')
      .eq('yil', yil)
      .order('tarih');
    if (error) throw error;
    return (data ?? []) as HolidayRow[];
  }

  async create(data: CreateHolidayInput): Promise<HolidayRow> {
    const yil = new Date(data.tarih).getFullYear();
    const { data: row, error } = await this.db
      .from('integration_public_holidays')
      .insert({ tarih: data.tarih, aciklama: data.aciklama, yil, yarim_gun: data.yarimGun ?? false })
      .select('*')
      .single();
    if (error) throw error;
    return row as HolidayRow;
  }

  async isHoliday(tarih: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('integration_public_holidays')
      .select('tarih')
      .eq('tarih', tarih)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }
}
