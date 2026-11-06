import { NotFoundError, ValidationError } from '@pms/shared';

/**
 * B1 (Day 11): "project testleri (çakışma/kapasite) + tamamlama". `assign-personnel.usecase.ts`
 * (Day 7) bu doğrulamayı "Day 11+, personnel-service ile REST entegrasyonu genişleyince" notuyla
 * ertelemişti — `service.config.ts`'teki `personnelServiceUrl` zaten o günden beri hazır
 * bekliyordu (Day 6/8'deki AYNI desen: config önce, tüketici sonra). Kırılmaz Kural gereği
 * project-service, personnel-service'in tablosuna asla doğrudan erişemez — bu istemci
 * finance-service/notification-service'teki `PersonnelServiceClient` ile AYNI kalıbı izler.
 */
export class PersonnelServiceClient {
  constructor(private readonly baseUrl: string) {}

  async assertEmployeeActive(employeeId: string): Promise<void> {
    const response = await fetch(new URL(`/employees/${employeeId}`, this.baseUrl));
    if (!response.ok) {
      throw new NotFoundError('Personel', employeeId);
    }
    const body = (await response.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
    if (body.data.durum !== 'active') {
      throw new ValidationError(`Personel (${employeeId}) aktif değil, atama yapılamaz.`);
    }
  }
}
