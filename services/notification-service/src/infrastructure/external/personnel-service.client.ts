import { NotFoundError } from '@pms/shared';

/**
 * notification-service, personnel-service'in tablosuna ASLA doğrudan dokunmaz — bir çalışanın
 * e-posta adresini her zaman bu REST istemcisi üzerinden çözer (KIRILMAZ KURAL, Bölüm 2/2.1).
 */
export class PersonnelServiceClient {
  constructor(private readonly baseUrl: string) {}

  async getEmployeeEmail(employeeId: string): Promise<{ email: string; ad: string; soyad: string }> {
    const response = await fetch(new URL(`/employees/${employeeId}`, this.baseUrl));
    if (!response.ok) {
      throw new NotFoundError('Personel', employeeId);
    }
    const body = (await response.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
    return { email: body.data.email, ad: body.data.ad, soyad: body.data.soyad };
  }
}
