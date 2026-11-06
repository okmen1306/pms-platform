/**
 * Day 20 (G-15): personnel-service, "bu personel herhangi bir projeye atanmış mı?" sorusunu
 * project-service'in `GET /employees/:id/calendar` uç noktasından sorar. Kırılmaz Kural gereği
 * project-service'in tablosuna ASLA doğrudan SQL atılmaz (bkz. docs/roadmap.md Bölüm 2/2.1).
 * Day 2'den beri `employee.repository.ts`'te sabit `false` dönen yer tutucunun yerini alır.
 */
export class ProjectServiceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 3000,
  ) {}

  async hasAssignments(employeeId: string): Promise<boolean> {
    const response = await fetch(new URL(`/employees/${employeeId}/calendar`, this.baseUrl), {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`project-service /employees/:id/calendar ${response.status} döndü`);
    }
    const body = (await response.json()) as { data?: unknown[] }; // fetch tiplemesi Promise<unknown> döner
    return Array.isArray(body.data) && body.data.length > 0;
  }
}
