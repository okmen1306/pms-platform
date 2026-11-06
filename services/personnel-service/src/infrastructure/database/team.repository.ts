import type { SupabaseClient } from '@supabase/supabase-js';

export interface TeamRow {
  id: string;
  ad: string;
  aciklama: string | null;
}

export interface TeamMemberRow {
  id: string;
  team_id: string;
  employee_id: string;
  sorumluluk: string | null;
  baslangic_tarihi: string;
  bitis_tarihi: string | null;
  aktif: boolean;
}

/** Day 1'de tanımlanan arayüz; Day 3'te tam implementasyon eklendi. */
export interface TeamRepository {
  findAll(): Promise<TeamRow[]>;
  create(ad: string, aciklama?: string): Promise<TeamRow>;
  addMember(teamId: string, employeeId: string, sorumluluk?: string): Promise<TeamMemberRow>;
  listMembers(teamId: string): Promise<TeamMemberRow[]>;
  /** Bir personelin ÜYE OLDUĞU tüm ekipleri döner — madde 8: personel birden fazla ekipte çalışabilir. */
  listTeamsForEmployee(employeeId: string): Promise<TeamRow[]>;
}

export class SupabaseTeamRepository implements TeamRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(): Promise<TeamRow[]> {
    const { data, error } = await this.db.from('personnel_teams').select('*').order('ad');
    if (error) throw error;
    return (data ?? []) as TeamRow[];
  }

  async create(ad: string, aciklama?: string): Promise<TeamRow> {
    const { data, error } = await this.db
      .from('personnel_teams')
      .insert({ ad, aciklama: aciklama ?? null })
      .select('*')
      .single();
    if (error) throw error;
    return data as TeamRow;
  }

  /**
   * Kural: bir personel birden fazla ekipte çalışabilir (UNIQUE (team_id, employee_id,
   * baslangic_tarihi) — aynı ekibe aynı gün ikinci kez eklenemez, ama farklı ekiplere eklenebilir).
   */
  async addMember(teamId: string, employeeId: string, sorumluluk?: string): Promise<TeamMemberRow> {
    const { data, error } = await this.db
      .from('personnel_team_members')
      .insert({ team_id: teamId, employee_id: employeeId, sorumluluk: sorumluluk ?? null })
      .select('*')
      .single();
    if (error) throw error;
    return data as TeamMemberRow;
  }

  async listMembers(teamId: string): Promise<TeamMemberRow[]> {
    const { data, error } = await this.db
      .from('personnel_team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('aktif', true);
    if (error) throw error;
    return (data ?? []) as TeamMemberRow[];
  }

  async listTeamsForEmployee(employeeId: string): Promise<TeamRow[]> {
    const { data, error } = await this.db
      .from('personnel_team_members')
      .select('team_id, personnel_teams(id, ad, aciklama)')
      .eq('employee_id', employeeId)
      .eq('aktif', true);
    if (error) throw error;
    return (data ?? []).map((r: any) => r.personnel_teams) as TeamRow[];
  }
}
