import { AppError } from './app.error';

/** bkz. roadmap.md Bölüm 9 — Hata Kodu Kataloğu */

export class ConflictAssignmentError extends AppError {
  // NOT (Day 7): alan adı shared/dto/assignment.dto.ts -> AssignmentConflictDetailSchema ile
  // birebir aynı tutuldu (conflictingAssignmentIds) ki API yanıtı DTO sözleşmesiyle uyuşsun.
  constructor(employeeId: string, conflictingAssignmentIds: string[]) {
    super(
      'ASSIGNMENT_CONFLICT',
      409,
      `Personel (${employeeId}) belirtilen tarih aralığında başka bir göreve atanmış.`,
      { employeeId, conflictingAssignmentIds },
    );
  }
}

export class WeeklyCapacityExceededError extends AppError {
  constructor(teamId: string, projectId: string) {
    super(
      'WEEKLY_CAPACITY_EXCEEDED',
      409,
      `Ekip (${teamId}) için planlanan toplam hafta sayısı, projenin bitiş hafta sayısını aşıyor.`,
      { teamId, projectId },
    );
  }
}

export class ForbiddenPageAccessError extends AppError {
  constructor(roleKod: string, permissionKey: string) {
    super(
      'FORBIDDEN_PAGE_ACCESS',
      403,
      `Rol (${roleKod}) bu sayfaya erişim yetkisine sahip değil: ${permissionKey}`,
      { roleKod, permissionKey },
    );
  }
}

export class EmployeeDeletionNotAllowedError extends AppError {
  constructor(employeeId: string) {
    super(
      'EMPLOYEE_DELETION_NOT_ALLOWED',
      409,
      `Personel (${employeeId}) bir projeye atanmış, silinemez. Sadece inactive yapılabilir.`,
      { employeeId },
    );
  }
}

export class WorkPackageDateOutOfRangeError extends AppError {
  constructor(subWorkPackageId: string) {
    super(
      'WORK_PACKAGE_DATE_OUT_OF_RANGE',
      422,
      `Alt iş paketi (${subWorkPackageId}) tarihi, üst iş paketinin tarih aralığının dışında.`,
      { subWorkPackageId },
    );
  }
}

export class ExchangeRateUnavailableError extends AppError {
  constructor(date: string) {
    super('EXCHANGE_RATE_UNAVAILABLE', 503, `${date} tarihi için TCMB kuru alınamadı.`, { date });
  }
}

export class InvalidRoleTransitionError extends AppError {
  constructor(fromRoleId: string, toRoleId: string) {
    super('INVALID_ROLE_TRANSITION', 400, `Geçersiz rol değişikliği.`, { fromRoleId, toRoleId });
  }
}

export class RoleInUseCannotDeleteError extends AppError {
  constructor(roleId: string, activeUserCount: number) {
    super(
      'ROLE_IN_USE_CANNOT_DELETE',
      409,
      `Bu role bağlı ${activeUserCount} aktif kullanıcı var; önce başka role taşıyın.`,
      { roleId, activeUserCount },
    );
  }
}

export class SystemRoleCannotDeleteError extends AppError {
  constructor(roleId: string, kod: string) {
    super(
      'SYSTEM_ROLE_CANNOT_DELETE',
      409,
      `"${kod}" bir sistem rolüdür ve silinemez.`,
      { roleId, kod },
    );
  }
}

export class SuperAdminLimitExceededError extends AppError {
  constructor() {
    super('SUPER_ADMIN_LIMIT_EXCEEDED', 409, 'En fazla 3 super-admin kullanıcısına izin verilir.');
  }
}
