export interface EffectivePermission {
  permission_key: string;
  can_view: boolean;
  can_edit: boolean;
  is_override: boolean;
}

/**
 * api-gateway, identity-service'in tablosuna ASLA doğrudan dokunmaz — bir kullanıcının etkin
 * iznini her zaman bu REST istemcisi üzerinden sorgular (KIRILMAZ KURAL, Bölüm 2/2.1).
 * HER İSTEKTE identity-service'e gidiyor — bilinçli bir performans borcu, TODO ile işaretlendi.
 * (Day 16 düzeltmesi: bu yorum ÖNCEDEN "Day 15'te Redis cache eklenecek" diyordu — Day 15'in
 * gerçek kapsamı `employee.updated` → project/finance cache'i oldu (bkz. CHANGELOG.md), bu
 * yüzden o tahmin YANLIŞ çıktı ve düzeltildi. Bu cache HÂLÂ yapılmadı, gün numarası vermeden
 * açık bırakılıyor.)
 */
export class IdentityServiceClient {
  constructor(private readonly baseUrl: string) {}

  async getEffectivePermissions(userId: string): Promise<EffectivePermission[]> {
    const response = await fetch(new URL(`/users/${userId}/effective-permissions`, this.baseUrl));
    if (!response.ok) return [];
    const body = (await response.json()) as any; // NOT (Day 7 Q): fetch tiplemesi Promise<unknown> döner
    return body.data as EffectivePermission[];
  }

  // TODO (henüz planlanmadı, ileri bir gün): getEffectivePermissions sonucu
  // `gateway:permissions:{userId}` anahtarıyla kısa TTL ile cache'lenecek — her istekte
  // identity-service'e gitmek yerine.
}
