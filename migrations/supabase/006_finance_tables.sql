-- 006_finance_tables.sql
-- Day 6 | finance-service (B2) — sadece şirket_yoneticisi erişebilir (RLS Day 9-10'da eklenecek)
-- Kaynak: docs/roadmap.md Bölüm 4.6

CREATE TABLE finance_project_costs (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                    UUID UNIQUE NOT NULL,
  arge_maliyeti_usd              NUMERIC(14,2) DEFAULT 0,
  arge_maliyeti_tl               NUMERIC(14,2) DEFAULT 0,
  malzeme_maliyeti_tl            NUMERIC(14,2) DEFAULT 0,
  malzeme_maliyeti_usd           NUMERIC(14,2) DEFAULT 0,
  danismanlik_maliyeti_tl        NUMERIC(14,2) DEFAULT 0,
  paketleme_maliyeti_tl          NUMERIC(14,2) DEFAULT 0,
  diger_maliyetler_toplam_tl     NUMERIC(14,2) DEFAULT 0,
  idari_maliyet_tutari_tl        NUMERIC(14,2) DEFAULT 0,
  toplam_tahmini_maliyet_tl      NUMERIC(14,2) DEFAULT 0,
  toplam_gerceklesen_maliyet_tl  NUMERIC(14,2) DEFAULT 0,
  fark_tl                        NUMERIC(14,2) GENERATED ALWAYS AS
                                    (toplam_gerceklesen_maliyet_tl - toplam_tahmini_maliyet_tl) STORED,
  satis_fiyati_tl                 NUMERIC(14,2),
  kar_marji_yuzde                 NUMERIC(6,2),
  hesaplanma_tarihi               TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE finance_project_costs ENABLE ROW LEVEL SECURITY;

CREATE TABLE finance_personnel_weekly_cost (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                 UUID NOT NULL,
  employee_id                 UUID NOT NULL,
  hafta_no                    INTEGER NOT NULL,
  hafta_baslangic_tarihi      DATE NOT NULL,
  haftalik_maliyet_tl         NUMERIC(12,2) NOT NULL,
  haftalik_maliyet_usd        NUMERIC(12,2) NOT NULL,
  ayni_hafta_proje_sayisi     INTEGER NOT NULL DEFAULT 1,
  UNIQUE (project_id, employee_id, hafta_no)
);

CREATE TABLE finance_team_cost_summary (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL,
  team_id      UUID NOT NULL,
  toplam_maliyet_tl NUMERIC(14,2) NOT NULL DEFAULT 0,
  UNIQUE (project_id, team_id)
);

CREATE INDEX idx_finance_project ON finance_project_costs(project_id);

-- === Day 7 | finance-service (B2) — AR-GE maliyeti (haftalık bölme kuralı) ===
-- Kural: "Bir personel aynı hafta birden fazla projede görevliyse, o haftaki maliyeti proje
-- sayısına bölünür." finance-service, project-service'in `project_personnel_assignments`
-- tablosuna KIRILMAZ KURAL gereği erişemez; bu yüzden `assignment.created` event'ini dinleyip
-- (bkz. assignment-created.consumer.ts) kendi yerel "read model" önbelleğini tutar. Bu önbellek
-- SADECE bölme kuralı için "bu personel bu hafta kaç farklı projede görevli?" sorusuna cevap
-- vermek amacıyla vardır — CQRS'in "her servis kendi okuma modelini tutar" ilkesi.
CREATE TABLE finance_assignment_read_cache (
  assignment_id     UUID PRIMARY KEY,
  project_id        UUID NOT NULL,
  employee_id       UUID NOT NULL,
  baslangic_tarihi  DATE NOT NULL,
  bitis_tarihi      DATE NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_finance_assignment_cache_employee ON finance_assignment_read_cache(employee_id);

-- `project.created` event'inden gelen başlangıç tarihi + hafta sayısı önbelleği. AR-GE maliyeti
-- hesabı, integration-service'in `GET /week-ranges?startDate=&totalWeeks=` uç noktasını çağırmak
-- için bu ikisine ihtiyaç duyar (bkz. shared/utils/date.helper.ts — hafta hesaplama SADECE
-- integration-service'te yapılır, finance-service kendi hafta mantığını yeniden yazmaz).
CREATE TABLE finance_project_meta_cache (
  project_id        UUID PRIMARY KEY,
  baslangic_tarihi  DATE NOT NULL,
  sure_hafta        INTEGER NOT NULL
);

-- === Day 9 | finance-service (B2) — idari maliyet + kâr marjı ===
-- `idari_maliyet_orani` (örn. 0.08 = %8), project_projects'te yönetici tarafından girilir
-- (docs/roadmap.md Bölüm 4.4) ve `project.created` event'i ile BİR KEZ kopyalanır (bkz.
-- project-created.consumer.ts). idari_maliyet_tutari_tl (TL tutarı) her rollup'ta bu orandan
-- YENİDEN hesaplandığından (diğer maliyet bileşenleri zamanla değiştiği için), oranın kendisinin
-- kalıcı olması gerekiyor — bu yüzden ayrı bir kolon.
ALTER TABLE finance_project_costs
  ADD COLUMN idari_maliyet_orani NUMERIC(5,4) DEFAULT 0;

