import type { RiskRepository } from '../../infrastructure/database/risk.repository';

/** Kural: risk analizini projede yer alan TÜM personel görüntüleyebilmeli (görüntüleme kısıtsız). */
export async function listRisksByProject(projectId: string, repo: RiskRepository) {
  return repo.listByProject(projectId);
}
