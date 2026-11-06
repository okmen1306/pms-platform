import type { IntegrationServiceClient } from '../../infrastructure/external/integration-service.client';

/**
 * Kural #3 (docs/roadmap.md): proje süresi hesaplanırken resmî tatil günleri düşülür.
 * "sure_hafta" = iş günü sayısı / 5 (yukarı yuvarlanır), integration-service'ten alınan
 * tek doğru kaynağa göre hesaplanır — proje-service kendi tatil mantığını yazmaz.
 */
export async function calculateProjectDurationWeeks(
  startDate: string,
  endDate: string,
  integrationClient: IntegrationServiceClient,
): Promise<number> {
  const result = await integrationClient.getBusinessDays(startDate, endDate);
  return Math.ceil(result.totalBusinessDays / 5);
}
