import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectCostRow {
  id: string;
  project_id: string;
  arge_maliyeti_usd: number;
  arge_maliyeti_tl: number;
  malzeme_maliyeti_tl: number;
  malzeme_maliyeti_usd: number;
  danismanlik_maliyeti_tl: number;
  paketleme_maliyeti_tl: number;
  diger_maliyetler_toplam_tl: number;
  // B2 (Day 9): oranın KENDİSİ de saklanmalı — idari_maliyet_tutari_tl her rollup'ta YENİDEN
  // hesaplanıyor (diğer bileşenler zamanla değiştiği için, bkz. recalculateCostRollup), bu
  // yüzden sadece TUTAR değil ORAN da kalıcı olmalı. project-service'in `project_projects.
  // idari_maliyet_orani` alanının salt-okunur bir önbelleği (Kırılmaz Kural — `project.created`
  // event'i ile senkronize edilir, bkz. project-created.consumer.ts).
  idari_maliyet_orani: number;
  idari_maliyet_tutari_tl: number;
  toplam_tahmini_maliyet_tl: number;
  toplam_gerceklesen_maliyet_tl: number;
  fark_tl: number;
  satis_fiyati_tl: number | null;
  kar_marji_yuzde: number | null;
}

export interface PersonnelWeeklyCostRow {
  id: string;
  project_id: string;
  employee_id: string;
  hafta_no: number;
  hafta_baslangic_tarihi: string;
  haftalik_maliyet_tl: number;
  haftalik_maliyet_usd: number;
  ayni_hafta_proje_sayisi: number;
}

export interface UpsertWeeklyCostInput {
  project_id: string;
  employee_id: string;
  hafta_no: number;
  hafta_baslangic_tarihi: string;
  haftalik_maliyet_tl: number;
  haftalik_maliyet_usd: number;
  ayni_hafta_proje_sayisi: number;
}

export interface InitializeProjectCostInput {
  toplamTahminiMaliyetTl?: number;
  satisFiyatiTl?: number;
  danismanlikMaliyetiTl?: number;
  paketlemeMaliyetiTl?: number;
  idariMaliyetOrani?: number;
}

/**
 * Day 6: sadece iskelet (proje oluşturulunca sıfırlarla bir satır açılıyor). Day 7'de AR-GE
 * maliyeti (haftalık personel maliyeti + proje toplamı) eklendi. Day 8'de malzeme maliyeti
 * eklendi. Day 9'da idari maliyet oranı/tutarı + kâr marjı eklendi.
 */
export interface CostRepository {
  findByProject(projectId: string): Promise<ProjectCostRow | null>;
  /**
   * B2 (Day 9): `project.created` event'i artık yöneticinin proje oluştururken girdiği
   * (`project_projects` tablosundaki, "SADECE YONETICI" alanları — bkz. docs/roadmap.md Bölüm
   * 4.4) tahmini maliyet/satış fiyatı/danışmanlık/paketleme/idari maliyet oranını da taşıyor
   * (bkz. shared/events/project.events.ts ProjectCreatedEventSchema Day 9 eklentisi). Bu değerler
   * BİR KEZ (proje oluşturulurken) kopyalanır — sonrasında sadece project-service'in KENDİSİ
   * bunları değiştirebilir (henüz bir "proje güncelleme" akışı/event'i yok, o yüzden şimdilik
   * tek seferlik senkronizasyon yeterli).
   */
  initializeForProject(projectId: string, init?: InitializeProjectCostInput): Promise<ProjectCostRow>;
  upsertWeeklyCost(row: UpsertWeeklyCostInput): Promise<void>;
  listWeeklyCostsByProject(projectId: string): Promise<PersonnelWeeklyCostRow[]>;
  /**
   * B2 (Day 8): `material.purchased` her yayınlandığında `malzeme_maliyeti_tl/usd`'a DELTA
   * (o satın almanın tutarı) ekler — bir proje boyunca BİRDEN FAZLA malzeme satın alınabileceği
   * için alan her seferinde EZİLMEZ, biriktirilir (procurement-service'in kendi
   * `procurement_stock_movements` tablosu zaten "tek doğruluk kaynağı"; burası sadece finance'in
   * kendi salt-okunur toplamı, bkz. Kırılmaz Kural). Supabase JS istemcisi atomik `UPDATE ... SET
   * x = x + delta` desteklemediğinden (RPC/raw SQL fonksiyonu yazılmadıkça), `recalculateCostRollup`
   * ile AYNI "oku-hesapla-yaz" deseni kullanılır — tek tüketicili (bu consumer) sıralı işlem
   * modelinde kabul edilebilir bir bilinçli sınırlama (bkz. CHANGELOG.md).
   */
  addMaterialCost(projectId: string, deltaTl: number, deltaUsd: number): Promise<ProjectCostRow>;
  /**
   * Day 7'de "recalculateArgeRollup" adıyla YALNIZCA AR-GE tüketicisi tarafından çağrılıyordu;
   * Day 8'de `addMaterialCost`'un da toplam_gerceklesen_maliyet_tl'yi güncelleyebilmesi için
   * AYNI mantık gerekti — isim artık yanıltıcı olacağından (yalnızca AR-GE değil, TÜM bileşenleri
   * yeniden toplayan genel bir "rollup") `recalculateCostRollup` olarak yeniden adlandırıldı
   * (Uzman İnisiyatifi — bkz. CHANGELOG.md Day 8). Day 9'da idari maliyet tutarı + kâr marjı
   * hesabı da BURAYA eklendi (tüm bileşenler her değiştiğinde otomatik güncel kalsınlar diye —
   * ayrı bir "hesapla" endpoint'i YOK, her yazma zaten bu fonksiyonu tetikliyor).
   */
  recalculateCostRollup(projectId: string): Promise<ProjectCostRow>;
}

export class SupabaseCostRepository implements CostRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByProject(projectId: string): Promise<ProjectCostRow | null> {
    const { data, error } = await this.db
      .from('finance_project_costs')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw error;
    return data as ProjectCostRow | null;
  }

  async initializeForProject(projectId: string, init: InitializeProjectCostInput = {}): Promise<ProjectCostRow> {
    const { data, error } = await this.db
      .from('finance_project_costs')
      .upsert(
        {
          project_id: projectId,
          toplam_tahmini_maliyet_tl: init.toplamTahminiMaliyetTl ?? 0,
          satis_fiyati_tl: init.satisFiyatiTl ?? null,
          danismanlik_maliyeti_tl: init.danismanlikMaliyetiTl ?? 0,
          paketleme_maliyeti_tl: init.paketlemeMaliyetiTl ?? 0,
          idari_maliyet_orani: init.idariMaliyetOrani ?? 0,
        },
        { onConflict: 'project_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data as ProjectCostRow;
  }

  async upsertWeeklyCost(row: UpsertWeeklyCostInput): Promise<void> {
    const { error } = await this.db
      .from('finance_personnel_weekly_cost')
      .upsert(row, { onConflict: 'project_id,employee_id,hafta_no' });
    if (error) throw error;
  }

  async listWeeklyCostsByProject(projectId: string): Promise<PersonnelWeeklyCostRow[]> {
    const { data, error } = await this.db
      .from('finance_personnel_weekly_cost')
      .select('*')
      .eq('project_id', projectId)
      .order('hafta_no');
    if (error) throw error;
    return (data ?? []) as PersonnelWeeklyCostRow[];
  }

  async addMaterialCost(projectId: string, deltaTl: number, deltaUsd: number): Promise<ProjectCostRow> {
    const current = await this.findByProject(projectId);
    if (!current) throw new Error(`finance_project_costs bulunamadı: ${projectId}`);

    const { error } = await this.db
      .from('finance_project_costs')
      .update({
        malzeme_maliyeti_tl: Number(current.malzeme_maliyeti_tl) + deltaTl,
        malzeme_maliyeti_usd: Number(current.malzeme_maliyeti_usd) + deltaUsd,
      })
      .eq('project_id', projectId);
    if (error) throw error;

    // toplam_gerceklesen_maliyet_tl'nin tüm bileşenlerin GÜNCEL toplamını yansıtması için
    // rollup'ı hemen tetikle (aksi halde malzeme maliyeti eklenir ama genel toplam eski kalır).
    return this.recalculateCostRollup(projectId);
  }

  async recalculateCostRollup(projectId: string): Promise<ProjectCostRow> {
    const weeklyRows = await this.listWeeklyCostsByProject(projectId);
    const argeMaliyetiTl = weeklyRows.reduce((sum, r) => sum + Number(r.haftalik_maliyet_tl), 0);
    const argeMaliyetiUsd = weeklyRows.reduce((sum, r) => sum + Number(r.haftalik_maliyet_usd), 0);

    const current = await this.findByProject(projectId);
    if (!current) throw new Error(`finance_project_costs bulunamadı: ${projectId}`);

    // B2 (Day 9): "idari maliyet hesaplama". docs/roadmap.md Bölüm 4.4'te `idari_maliyet_orani`
    // (örn. 0.08 = %8) alanı proje bazında yönetici tarafından girilir ama HANGİ tutara
    // uygulandığı roadmap'te (veya erişebildiğimiz isterler metninde) açıkça yazmıyor — Uzman
    // İnisiyatifi: standart genel gider (overhead) dağıtım yöntemi izlendi: oran, idari maliyetin
    // KENDİSİ HARİÇ tüm DOĞRUDAN maliyet bileşenlerinin toplamına uygulanır (dairesel olmasın diye).
    const dogrudanMaliyetlerTl =
      argeMaliyetiTl +
      Number(current.malzeme_maliyeti_tl) +
      Number(current.danismanlik_maliyeti_tl) +
      Number(current.paketleme_maliyeti_tl) +
      Number(current.diger_maliyetler_toplam_tl);

    const idariMaliyetTutariTl = dogrudanMaliyetlerTl * Number(current.idari_maliyet_orani);
    const toplamGerceklesen = dogrudanMaliyetlerTl + idariMaliyetTutariTl;

    // B2 (Day 9): "kâr marjı hesaplama" — standart formül: (satış fiyatı - gerçekleşen maliyet) /
    // satış fiyatı × 100. Yönetici satış fiyatını GİRMEMİŞSE (proje henüz fiyatlandırılmamışsa)
    // null kalır — CostAnalysisPage (Day 8) bunu zaten "Henüz hesaplanmadı" olarak gösteriyor.
    const satisFiyatiTl = current.satis_fiyati_tl !== null ? Number(current.satis_fiyati_tl) : null;
    const karMarjiYuzde =
      satisFiyatiTl !== null && satisFiyatiTl > 0
        ? Math.round(((satisFiyatiTl - toplamGerceklesen) / satisFiyatiTl) * 100 * 100) / 100 // %6,2 hassasiyet
        : null;

    const { data, error } = await this.db
      .from('finance_project_costs')
      .update({
        arge_maliyeti_tl: argeMaliyetiTl,
        arge_maliyeti_usd: argeMaliyetiUsd,
        idari_maliyet_tutari_tl: idariMaliyetTutariTl,
        toplam_gerceklesen_maliyet_tl: toplamGerceklesen,
        kar_marji_yuzde: karMarjiYuzde,
        hesaplanma_tarihi: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .select('*')
      .single();
    if (error) throw error;
    return data as ProjectCostRow;
  }
}
