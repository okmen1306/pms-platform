import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ok,
  okList,
  RabbitMqClient,
  ASSIGNMENT_EVENTS,
  CreateAssignmentDtoSchema,
  MarkAssignmentCompleteDtoSchema,
  AssignmentConflictCheckQuerySchema,
  NotFoundError,
  type AuditPublisherFn,
} from '@pms/shared';
import { assignPersonnel } from '../core/use-cases/assign-personnel.usecase';
import { markAssignmentComplete } from '../core/use-cases/mark-assignment-complete.usecase';
import { checkAssignmentConflict } from '../core/use-cases/check-assignment-conflict.usecase';
import { getEmployeeCalendar } from '../core/use-cases/get-employee-calendar.usecase';
import type { ProjectRepository } from '../infrastructure/database/project.repository';
import type { AssignmentRepository } from '../infrastructure/database/assignment.repository';
import type { WorkPackageRepository } from '../infrastructure/database/work-package.repository';
import type { PersonnelServiceClient } from '../infrastructure/external/personnel-service.client';

export interface AssignmentControllerDeps {
  assignmentRepo: AssignmentRepository;
  workPackageRepo: WorkPackageRepository;
  projectRepo: ProjectRepository;
  personnelClient: PersonnelServiceClient;
  rabbit: RabbitMqClient;
  publishAudit: AuditPublisherFn;
}

export function registerAssignmentRoutes(app: FastifyInstance, deps: AssignmentControllerDeps) {
  app.post('/projects/:id/assignments', async (request) => {
    // RBAC (Day 21, G-01): gateway'de `project.records` edit ile zorlanır (ekip_lideri + sirket_yoneticisi).
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const body = CreateAssignmentDtoSchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';

    const created = await assignPersonnel(
      id,
      body,
      actorUserId,
      deps.assignmentRepo,
      deps.workPackageRepo,
      deps.personnelClient,
      deps.publishAudit,
      (event) => deps.rabbit.publish(ASSIGNMENT_EVENTS.CREATED, event),
      (event) => deps.rabbit.publish(ASSIGNMENT_EVENTS.CONFLICT_DETECTED, event),
    );
    return ok(created);
  });

  app.get('/projects/:id/assignments', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    // Day 20: `?employeeId=` filtresi (roadmap Bölüm 8) — personelin bu projedeki atamaları.
    const { employeeId } = z.object({ employeeId: z.guid().optional() }).parse(request.query);
    const items = await deps.assignmentRepo.findByProject(id, { employeeId });
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  /**
   * Day 20 (roadmap Bölüm 8): bir personelin TÜM projelerdeki görevleri tek takvimde. personnel-service
   * "bu personel herhangi bir projeye atanmış mı?" sorusunu da buradan sorar (Kırılmaz Kural: kendi
   * tablosuna değil, bu REST uç noktasına).
   */
  app.get('/employees/:id/calendar', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const range = z
      .object({ from: z.string().date().optional(), to: z.string().date().optional() })
      .parse(request.query);
    const items = await getEmployeeCalendar(id, range, deps.assignmentRepo, deps.projectRepo);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  /**
   * B1 (Day 8): "çakışma uyarı endpoint'i". `:id` (proje) sadece URL tutarlılığı için burada —
   * çakışma kontrolü personel bazlı olduğundan (bkz. findOverlapping) doğrulanmıyor/kullanılmıyor,
   * tıpkı F1'in atama formunun HANGİ projeden çağrıldığından bağımsız çalışması gibi. POST
   * /projects/:id/assignments'ın DB seviyesindeki garantisinin (EXCLUDE USING gist) YERİNE
   * GEÇMEZ — sadece formun GÖNDER'e basmadan önce kullanıcıyı uyarabilmesi için salt-okunur
   * bir ön-kontrol.
   */
  app.get('/projects/:id/assignments/conflict-check', async (request) => {
    z.object({ id: z.guid() }).parse(request.params);
    const query = AssignmentConflictCheckQuerySchema.parse(request.query);
    const result = await checkAssignmentConflict(query, deps.assignmentRepo);
    return ok(result);
  });

  /**
   * notification-service'in gecikme cron'u (delay-check.cron.ts) bir atamanın hâlâ gecikmiş
   * olup olmadığını (tamamlandi_mi hâlâ false mu?) e-posta göndermeden ÖNCE bu uç noktayla
   * doğrular (Kırılmaz Kural — notification, project-service'in tablosuna doğrudan erişemez).
   */
  app.get('/assignments/:id', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const found = await deps.assignmentRepo.findById(id);
    if (!found) throw new NotFoundError('Personel ataması', id);
    return ok(found);
  });

  app.patch('/assignments/:id/complete', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const body = MarkAssignmentCompleteDtoSchema.parse(request.body ?? {});
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const updated = await markAssignmentComplete(
      id,
      body.tamamlanmaTarihi,
      actorUserId,
      deps.assignmentRepo,
      deps.publishAudit,
    );
    return ok(updated);
  });
}
