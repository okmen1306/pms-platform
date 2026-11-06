import type { TeamRepository } from '../../infrastructure/database/team.repository';

/**
 * Madde 8 (docs/roadmap.md): "Personel seçildiğinde bağlı olduğu ekip ve buna bağlı görevi
 * otomatik olarak ekrana gelebilmeli." Bu use-case, project-service'in personel atama
 * ekranında (Day 7+) kullanacağı REST çağrısının backend'idir.
 */
export async function getEmployeeTeamsAndRoles(employeeId: string, teamRepo: TeamRepository) {
  return teamRepo.listTeamsForEmployee(employeeId);
}
