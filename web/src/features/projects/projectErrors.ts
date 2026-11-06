import { ApiError } from '../../shared/api';

export interface ProjectErrorContext {
  /** Atama formundaki seçili personelin adı (backend mesajı ham UUID içeriyor). */
  employeeName?: string;
  /** Haftalık planlama formundaki seçili ekibin adı (backend mesajı ham UUID içeriyor). */
  teamName?: string;
  /** Projenin toplam hafta sayısı (kapasite sınırı). */
  projectWeeks?: number;
}

/**
 * Day 19 (Entegrasyon Haftası): backend'in iş kuralı hataları (409 ASSIGNMENT_CONFLICT,
 * 409 WEEKLY_CAPACITY_EXCEEDED) gerçek API'ye karşı denenince ham UUID içeren mesajlar döndürdüğü
 * görüldü (ör. "Personel (51aadd52-...) belirtilen tarih aralığında..."). Mock dönemi bu mesajı
 * hiç görmemişti. Kullanıcıya UUID değil, ad + anlaşılır bir cümle gösterilir; bilinmeyen
 * hatalarda sunucunun kendi mesajı aynen korunur.
 */
export function describeProjectError(error: unknown, ctx: ProjectErrorContext = {}, fallback = 'İşlem başarısız'): string {
  if (error instanceof ApiError) {
    if (error.code === 'ASSIGNMENT_CONFLICT') {
      const ids = (error.details as { conflictingAssignmentIds?: unknown } | undefined)?.conflictingAssignmentIds;
      const count = Array.isArray(ids) ? ids.length : null;
      const who = ctx.employeeName ?? 'Bu personel';
      return count
        ? `${who}, seçilen tarih aralığında zaten ${count} atamaya sahip. Farklı bir tarih aralığı seçin.`
        : `${who}, seçilen tarih aralığında başka bir göreve atanmış. Farklı bir tarih aralığı seçin.`;
    }
    if (error.code === 'WEEKLY_CAPACITY_EXCEEDED') {
      const who = ctx.teamName ?? 'Bu ekip';
      const cap = ctx.projectWeeks !== undefined ? ` (${ctx.projectWeeks} hafta)` : '';
      return `${who} için planlanan toplam süre projenin süresini${cap} aşıyor.`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}
