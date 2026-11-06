import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, NotFoundError, type AuditPublisherFn, type EffectivePermission } from '@pms/shared';
import { listEmployees, toPublicEmployee } from '../core/use-cases/list-employees.usecase';
import { createEmployee } from '../core/use-cases/create-employee.usecase';
import { updateEmployee, type EmployeeUpdatedPublisherFn } from '../core/use-cases/update-employee.usecase';
import { deactivateEmployee } from '../core/use-cases/deactivate-employee.usecase';
import type { EmployeeRepository } from '../infrastructure/database/employee.repository';

const CreateEmployeeBodySchema = z.object({
  ad: z.string().min(1),
  soyad: z.string().min(1),
  email: z.string().email(),
  iseBaslamaTarihi: z.string().date(),
  maasTl: z.number().positive(),
});

/** Day 15: roadmap.md satır 1471 — `PATCH /employees/:id (ik_yoneticisi)`. `durum` KASITLI OLARAK yok (bkz. update-employee.usecase.ts). */
const UpdateEmployeeBodySchema = z
  .object({
    ad: z.string().min(1).optional(),
    soyad: z.string().min(1).optional(),
    email: z.string().email().optional(),
    maasTl: z.number().positive().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Güncellenecek en az bir alan gerekli.' });

export interface EmployeeControllerDeps {
  employeeRepo: EmployeeRepository;
  hasAssignments: (employeeId: string) => Promise<boolean>;
  publishAudit: AuditPublisherFn;
  /** Day 15: `employee.created`/`employee.updated` — bkz. update-employee.usecase.ts. */
  publishEmployeeCreated: EmployeeUpdatedPublisherFn;
  publishEmployeeUpdated: EmployeeUpdatedPublisherFn;
  /**
   * Day 2: geçici çözüm. Gerçek etkin izin sorgusu identity-service'in
   * /users/:id/effective-permissions endpoint'i (Day 3-5) hazır olduğunda buraya bağlanacak;
   * o zamana kadar api-gateway henüz kurulmadığı için istekte JWT payload'ı da yok — bu yüzden
   * maaş varsayılan olarak GİZLİ döner (fail-closed, güvenli taraf).
   */
  getCallerPermissions: (request: unknown) => EffectivePermission[];
}

export function registerEmployeeRoutes(app: FastifyInstance, deps: EmployeeControllerDeps) {
  app.get('/employees', async (request) => {
    const { durum } = z.object({ durum: z.string().optional() }).parse(request.query);
    const callerPermissions = deps.getCallerPermissions(request);
    const items = await listEmployees({ durum }, callerPermissions, deps.employeeRepo);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  /**
   * Day 5 eklendi: notification-service'in başlangıç e-postası göndermek için ekip liderinin
   * e-posta adresini çözmesi gerekiyordu (bkz. personnel-service.client.ts). Tekil kayıt
   * endpoint'i eksikti — kırılmaz kural gereği notification-service veritabanına değil, bu
   * endpoint'e REST ile ulaşacak.
   */
  app.get('/employees/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const callerPermissions = deps.getCallerPermissions(request);
    const row = await deps.employeeRepo.findById(id);
    if (!row) throw new NotFoundError('Personel', id);
    return ok(toPublicEmployee(row, callerPermissions));
  });

  /**
   * Ek (Day 7 — finance-service AR-GE maliyeti için gerekli, bkz. roadmap.md satır ~1473
   * "GET /employees/:id/salary (ik_yoneticisi, sirket_yoneticisi)"). Bu, servisler-arası
   * (finance-service -> personnel-service) DOĞRUDAN bir REST çağrısıdır — Kırılmaz Kural
   * gereği finance-service `personnel_employees` tablosuna asla dokunmaz. Codebase'deki tüm
   * servis-arası çağrılar gibi (bkz. PersonnelServiceClient.getEmployeeEmail, IntegrationServiceClient)
   * api-gateway'in ARKASINDAN değil, servisler birbirine doğrudan Docker iç ağı üzerinden ulaşır;
   * bu yüzden burada `getCallerPermissions` maskeleme kontrolü UYGULANMAZ (ham değer döner).
   * Gerçek erişim kısıtlaması (ik_yoneticisi/sirket_yoneticisi) TARAYICI erişimi için
   * api-gateway'in `personnel.routes.ts` dosyasında `requirePermission(PERSONNEL_SALARY)` ile
   * uygulanıyor — bkz. api-gateway CHANGELOG.md Day 7 notu.
   */
  app.get('/employees/:id/salary', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const row = await deps.employeeRepo.findById(id);
    if (!row) throw new NotFoundError('Personel', id);
    return ok({ id: row.id, maasTl: row.maas_tl });
  });

  app.post('/employees', async (request) => {
    const body = CreateEmployeeBodySchema.parse(request.body);
    // TODO (Day 6-8, api-gateway hazır olunca): actorUserId gerçek JWT'den okunacak
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await createEmployee(body, actorUserId, deps.employeeRepo, deps.publishAudit, deps.publishEmployeeCreated);
    return ok(created);
  });

  /**
   * Day 15 eklendi: roadmap.md Day 1'den beri planlı olan tek endpoint, ama hiç yazılmamıştı
   * (bkz. docs/testing/event-integration-audit.md). `durum` buradan DEĞİŞMEZ — bkz. aşağıdaki
   * `/deactivate` uç noktası.
   */
  app.patch('/employees/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = UpdateEmployeeBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const updated = await updateEmployee(id, body, actorUserId, deps.employeeRepo, deps.publishAudit, deps.publishEmployeeUpdated);
    return ok(updated);
  });

  app.patch('/employees/:id/deactivate', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    await deactivateEmployee(id, actorUserId, deps.employeeRepo, deps.publishAudit, deps.publishEmployeeUpdated, deps.hasAssignments);
    return ok({ deactivated: true });
  });
}
