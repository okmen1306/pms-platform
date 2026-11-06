import type { MaterialRepository } from '../../infrastructure/database/material.repository';

export async function listProjectMaterials(projectId: string, repo: MaterialRepository) {
  return repo.listByProject(projectId);
}
