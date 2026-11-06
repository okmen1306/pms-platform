import { apiFetch } from '../../shared/api';

/**
 * Day 18 (Entegrasyon Haftası): Day 3'ten beri personnel-service'e DOĞRUDAN (3002) ve kimlik
 * bilgisiz bağlanıyordu ("Day 18 entegrasyon haftasında bu, api-gateway proxy'sinden geçecek
 * şekilde değiştirilecek"). Artık her çağrı gateway'in `/personnel/*` proxy'sinden geçiyor
 * (bkz. api-gateway/src/routes/personnel.routes.ts — `authenticate` + `x-actor-id` enjeksiyonu),
 * `Authorization: Bearer` shared/api/apiClient.ts tarafından eklenir. Dışa açık imzalar DEĞİŞMEDİ.
 */
export interface EmployeeListItem {
  id: string;
  ad: string;
  soyad: string;
  email: string;
  durum: 'active' | 'inactive';
  maasTl: number | null; // izin yoksa backend null döner (fail-closed, bkz. Day 2 CHANGELOG)
}

export async function fetchEmployees(durum?: string): Promise<EmployeeListItem[]> {
  const query = durum ? `?${new URLSearchParams({ durum }).toString()}` : '';
  return apiFetch<EmployeeListItem[]>(`/personnel/employees${query}`, { fallbackError: 'Personel listesi alınamadı' });
}

export interface CreateEmployeeInput {
  ad: string;
  soyad: string;
  email: string;
  iseBaslamaTarihi: string;
  maasTl: number;
}

/** Day 5: EmployeeFormPage'in bağlandığı gerçek POST çağrısı. */
export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeListItem> {
  return apiFetch<EmployeeListItem>('/personnel/employees', { method: 'POST', body: input, fallbackError: 'Personel eklenemedi' });
}

export interface Team {
  id: string;
  ad: string;
  aciklama: string | null;
}

export interface TeamMember {
  id: string;
  team_id: string;
  employee_id: string;
  sorumluluk: string | null;
}

export async function fetchTeams(): Promise<Team[]> {
  return apiFetch<Team[]>('/personnel/teams', { fallbackError: 'Ekip listesi alınamadı' });
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  return apiFetch<TeamMember[]>(`/personnel/teams/${teamId}/members`, { fallbackError: 'Ekip üyeleri alınamadı' });
}

export async function createTeam(ad: string, aciklama?: string): Promise<Team> {
  return apiFetch<Team>('/personnel/teams', { method: 'POST', body: { ad, aciklama }, fallbackError: 'Ekip oluşturulamadı' });
}

export async function addTeamMember(teamId: string, employeeId: string, sorumluluk?: string): Promise<TeamMember> {
  return apiFetch<TeamMember>(`/personnel/teams/${teamId}/members`, {
    method: 'POST',
    body: { employeeId, sorumluluk },
    fallbackError: 'Ekip üyesi eklenemedi',
  });
}
