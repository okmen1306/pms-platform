import { NotFoundError } from '@pms/shared';

/**
 * finance-service, personnel-service'in tablosuna ASLA doğrudan dokunmaz — bir personelin
 * maaşını her zaman bu REST istemcisi üzerinden çözer (KIRILMAZ KURAL, bkz. Bölüm 2/2.1).
 * Kullandığı `GET /employees/:id/salary` uç noktası Day 7'de bu amaçla eklendi
 * (bkz. personnel-service CHANGELOG.md Day 7 notu — maaş TARAYICI erişiminde
 * ik_yoneticisi/sirket_yoneticisi ile kısıtlıdır, ama servisler-arası çağrı doğrudandır).
 */
export class PersonnelServiceClient {
  constructor(private readonly baseUrl: string) {}

  async getEmployeeSalary(employeeId: string): Promise<{ maasTl: number }> {
    const response = await fetch(new URL(`/employees/${employeeId}/salary`, this.baseUrl));
    if (!response.ok) {
      throw new NotFoundError('Personel', employeeId);
    }
    const body = (await response.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
    return { maasTl: Number(body.data.maasTl) };
  }
}
