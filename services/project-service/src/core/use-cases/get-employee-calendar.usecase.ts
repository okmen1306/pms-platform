import type { AssignmentRepository, AssignmentRow } from '../../infrastructure/database/assignment.repository';
import type { ProjectRepository } from '../../infrastructure/database/project.repository';

export interface EmployeeCalendarEntry extends AssignmentRow {
  proje_adi: string | null;
}

/**
 * Day 20 (roadmap Bölüm 8: `GET /employees/:id/calendar`): bir personelin TÜM projelerdeki
 * atamaları tek takvimde. Proje adı, atamayı gösteren ekranın (ve personnel-service'in "atanmış mı"
 * sorgusunun) ikinci bir istek yapmasına gerek kalmasın diye eklenir.
 */
export async function getEmployeeCalendar(
  employeeId: string,
  range: { from?: string; to?: string },
  assignmentRepo: AssignmentRepository,
  projectRepo: ProjectRepository,
): Promise<EmployeeCalendarEntry[]> {
  const assignments = await assignmentRepo.findByEmployee(employeeId, range);
  const names = new Map<string, string | null>();
  for (const projectId of new Set(assignments.map((a) => a.project_id))) {
    names.set(projectId, (await projectRepo.findById(projectId))?.proje_adi ?? null);
  }
  return assignments.map((a) => ({ ...a, proje_adi: names.get(a.project_id) ?? null }));
}
