import type { AuditPublisherFn } from '@pms/shared';
import type { TeamRepository } from '../../infrastructure/database/team.repository';
import type { EmployeeRepository } from '../../infrastructure/database/employee.repository';
import { NotFoundError } from '@pms/shared';

export async function assignEmployeeToTeam(
  teamId: string,
  employeeId: string,
  sorumluluk: string | undefined,
  actorUserId: string,
  teamRepo: TeamRepository,
  employeeRepo: EmployeeRepository,
  publishAudit: AuditPublisherFn,
) {
  const employee = await employeeRepo.findById(employeeId);
  if (!employee) throw new NotFoundError('Personel', employeeId);

  const member = await teamRepo.addMember(teamId, employeeId, sorumluluk);

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'personnel_team_members',
    entityId: member.id,
    ozet: `${employee.ad} ${employee.soyad} bir ekibe atandı.`,
    severity: 'info',
  });

  return member;
}
