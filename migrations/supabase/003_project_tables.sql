-- 003_project_tables.sql
-- Kaynak: docs/roadmap.md Bölüm 4.3 (en büyük servis, birden fazla günde kümülatif doldurulur)

-- === Day 4 | project-service (B1) — ürün grubu/ürün + proje çekirdeği ===
CREATE TABLE project_product_groups (
  id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad  TEXT UNIQUE NOT NULL
);

CREATE TABLE project_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad                TEXT NOT NULL,
  product_group_id  UUID NOT NULL REFERENCES project_product_groups(id)
);

CREATE TABLE project_projects (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proje_adi                 TEXT NOT NULL,
  baslangic_tarihi          DATE NOT NULL,
  bitis_tarihi              DATE NOT NULL,
  sure_hafta                INTEGER NOT NULL,
  product_group_id          UUID NOT NULL REFERENCES project_product_groups(id),
  product_id                UUID NOT NULL REFERENCES project_products(id),
  durum                     TEXT NOT NULL DEFAULT 'yeni'
                               CHECK (durum IN ('yeni','devam_ediyor','tamamlandi','musteri_talepli_guncelleme')),
  ekip_lideri_id             UUID NOT NULL,
  tahmini_maliyet_tl         NUMERIC(14,2),
  satis_fiyati_tl            NUMERIC(14,2),
  danismanlik_maliyeti_tl    NUMERIC(14,2) DEFAULT 0,
  paketleme_gonderim_maliyeti_tl NUMERIC(14,2) DEFAULT 0,
  idari_maliyet_orani        NUMERIC(5,4) DEFAULT 0,
  created_by                 UUID NOT NULL,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW(),
  CHECK (bitis_tarihi >= baslangic_tarihi)
);
ALTER TABLE project_projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE project_extra_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES project_projects(id) ON DELETE CASCADE,
  aciklama    TEXT NOT NULL,
  tutar_tl    NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_status ON project_projects(durum);

-- === Day 5 | project-service (B1) — üst/alt iş paketleri ===

-- Şirket genelinde SABİT üst iş paketleri (madde 7 — bugüne kadar sabit kalmış, ileride
-- değişme ihtimaline karşı ENUM değil TABLO olarak tutuluyor). Statik/kurum-değişmez referans
-- verisi olduğu için 013_seed_data.sql'i (organizasyona özel dinamik veri: ekipler, izin
-- kataloğu, e-posta şablonları — Day 17) beklemeden burada, tablosuyla birlikte seed edildi
-- (bkz. CHANGELOG.md Day 5 Uzman İnisiyatifi).
CREATE TABLE project_master_work_packages (
  id      SMALLSERIAL PRIMARY KEY,
  sira_no NUMERIC(3,1) UNIQUE NOT NULL,
  ad      TEXT NOT NULL,
  ust_id  SMALLINT REFERENCES project_master_work_packages(id)
);

INSERT INTO project_master_work_packages (sira_no, ad, ust_id) VALUES
  (1,   'Planlama', NULL),
  (2,   'Dizayn', NULL);
INSERT INTO project_master_work_packages (sira_no, ad, ust_id)
  SELECT 2.1, 'Mekanik Aksam Tasarımı', id FROM project_master_work_packages WHERE sira_no = 2;
INSERT INTO project_master_work_packages (sira_no, ad, ust_id)
  SELECT 2.2, 'Kontrol ve Ölçüm Elektroniği Tasarımı', id FROM project_master_work_packages WHERE sira_no = 2;
INSERT INTO project_master_work_packages (sira_no, ad, ust_id)
  SELECT 2.3, 'Yazılım Tasarımı', id FROM project_master_work_packages WHERE sira_no = 2;
INSERT INTO project_master_work_packages (sira_no, ad, ust_id) VALUES
  (3,  'Satın Alma', NULL),
  (4,  'Malzeme Kabul/Kontrol', NULL),
  (5,  'Üretim/İmalat', NULL),
  (6,  'Yazılım Geliştirme', NULL),
  (7,  'Sistem Kurulum/Deneme', NULL),
  (8,  'Test ve İyileştirme', NULL),
  (9,  'Kalite Kontrol', NULL),
  (10, 'Paketleme', NULL);

-- Proje özelinde seçilen üst iş paketleri. Başlangıç/bitiş girilmezse "yok" sayılır (madde: E14 mantığı).
CREATE TABLE project_work_packages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES project_projects(id) ON DELETE CASCADE,
  master_work_package_id  SMALLINT NOT NULL REFERENCES project_master_work_packages(id),
  baslangic_tarihi        DATE,
  bitis_tarihi            DATE,
  kalite_puani            NUMERIC(4,2),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, master_work_package_id),
  CHECK (bitis_tarihi IS NULL OR baslangic_tarihi IS NULL OR bitis_tarihi >= baslangic_tarihi)
);

-- Alt iş paketleri; proje süresi başladıktan sonra da eklenip/düzenlenip/silinebilir.
CREATE TABLE project_sub_work_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_package_id   UUID NOT NULL REFERENCES project_work_packages(id) ON DELETE CASCADE,
  ad                TEXT NOT NULL,
  baslangic_hafta   INTEGER NOT NULL CHECK (baslangic_hafta > 0),
  bitis_hafta       INTEGER NOT NULL CHECK (bitis_hafta >= baslangic_hafta),
  baslangic_tarihi  DATE,
  bitis_tarihi      DATE,
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_wp_project ON project_work_packages(project_id);

-- === Day 6 | project-service (B1) — ekip haftalık planlama ===
-- Kural #7: planlanan hafta > 0 olmalı, bir ekibe ayrı ayrı verilen haftalık süre TOPLAMI
-- projenin bitiş hafta sayısını (project_projects.sure_hafta) geçemez. Bu kısıt UYGULAMA
-- katmanında kontrol edilir (allocate-team-weekly.usecase.ts) çünkü toplam, tek satırlık bir
-- CHECK constraint ile ifade edilemez (birden fazla satırın toplamı gerekiyor).
CREATE TABLE project_team_weekly_allocation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES project_projects(id) ON DELETE CASCADE,
  team_id               UUID NOT NULL,
  hafta_no              INTEGER NOT NULL CHECK (hafta_no > 0),
  planlanan_sure_hafta  NUMERIC(4,1) NOT NULL CHECK (planlanan_sure_hafta > 0),
  UNIQUE (project_id, team_id, hafta_no)
);

-- === Day 7 | project-service (B1) — personel ataması + çakışma engeli ===
-- Kural: "Bir personel aynı tarih aralığında iki işe atanamaz." Bu, UYGULAMA katmanında değil
-- DB seviyesinde bir EXCLUDE constraint ile garanti edilir — yarış koşullarında (iki eşzamanlı
-- istek) bile Postgres ikinci INSERT'i 23P01 (exclusion_violation) hatasıyla reddeder; uygulama
-- katmanı sadece bu hatayı yakalayıp 409 ASSIGNMENT_CONFLICT'e çevirir (bkz. assign-personnel.usecase.ts).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE project_personnel_assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES project_projects(id) ON DELETE CASCADE,
  work_package_id       UUID NOT NULL REFERENCES project_work_packages(id) ON DELETE CASCADE,
  sub_work_package_id   UUID REFERENCES project_sub_work_packages(id) ON DELETE CASCADE,
  employee_id           UUID NOT NULL,                -- personnel_employees.id (KIRILMAZ KURAL: FK yok, REST ile doğrulanır)
  baslangic_tarihi      DATE NOT NULL,
  bitis_tarihi          DATE NOT NULL,
  tamamlandi_mi         BOOLEAN DEFAULT FALSE,
  tamamlanma_tarihi     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  CHECK (bitis_tarihi >= baslangic_tarihi),
  -- Aynı personel, aynı tarih aralığında, birden fazla görevle ÇAKIŞAMAZ:
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(baslangic_tarihi, bitis_tarihi, '[]') WITH &&
  )
);

CREATE INDEX idx_project_assignments_project ON project_personnel_assignments(project_id);
CREATE INDEX idx_project_assignments_employee ON project_personnel_assignments(employee_id);

-- === Day 9 | project-service (B1) — milestone / zaman çizelgesi ===
-- Kaynak: docs/roadmap.md Bölüm 4.4. Proje ana sayfasındaki "Zaman Çizelgesi" + "Önemli Notlar"
-- bölümünün veri kaynağı. `hedef_gruplar` (örn. ['team:mekanik','role:ekip_lideri','email:x@y.com'])
-- ve `email_gonderilsin`, bir hatırlatma e-postası akışı İÇİN hazırlanmış alanlar — ama bu akışın
-- KENDİSİ (notification-service'in bir `milestone.created` consumer'ı) bugünün kapsamında DEĞİL
-- (roadmap'in Day 1-13 tablosunda hiçbir güne açıkça atanmamış; Kırılmaz Kural gereği bu
-- tabloya SADECE project-service yazar, notification-service'in kendi scheduled_jobs kaydını
-- KENDİSİ oluşturması gerekir — bkz. delay-check.cron.ts'teki emsal — bu yüzden burada
-- doğrudan `notification_scheduled_jobs`'a yazmıyoruz).
CREATE TABLE project_milestones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES project_projects(id) ON DELETE CASCADE,
  tarih             DATE NOT NULL,
  baslik            TEXT NOT NULL,
  aciklama          TEXT,
  email_gonderilsin BOOLEAN DEFAULT TRUE,
  hedef_gruplar     TEXT[],
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX idx_project_milestones_tarih ON project_milestones(tarih);

-- === Day 10 | project-service (B1) — iş taslağı (work draft, haftalık boyalı görünüm) ===
-- ÖNEMLİ (Uzman İnisiyatifi — bkz. CHANGELOG.md Day 10): roadmap.md'de bu özellik için NE bir
-- SQL şeması (Bölüm 4) NE de bir API uç noktası (Bölüm 8) tanımlı — sadece frontend dosya
-- ağacında "WorkDraftTab.tsx # is taslagi (haftalik boyali gorunum)" tek satırlık bir yorum var.
-- Muhtemelen erişemediğim bir isterler metnine dayanıyor. Bu yüzden minimal, geri alınabilir bir
-- yorum modeliyle ilerlendi: Excel prototipinin "sadece sarı hücrelere müdahale" felsefesine
-- (Bölüm 1) sadık kalarak, HER hücre proje × iş paketi × hafta bileşimi için basit bir AÇIK/KAPALI
-- (boyalı) bayrak. Karmaşık bir DURUM enum'u (planlandı/devam/tamamlandı gibi) İCAT EDİLMEDİ —
-- "boyalı görünüm" ifadesi sadece "hangi hücreler işaretli" diyor, durum çeşitliliği belirtmiyor.
-- Gerçek isterler farklıysa bu tablo/endpoint'ler kolayca değiştirilebilir (henüz hiçbir frontend
-- state'i buna bağımlı değil, sadece bugünkü WorkDraftTab).
CREATE TABLE project_work_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES project_projects(id) ON DELETE CASCADE,
  work_package_id UUID NOT NULL,
  hafta_no        INTEGER NOT NULL,
  boyali          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, work_package_id, hafta_no)
);
CREATE INDEX idx_project_work_drafts_project ON project_work_drafts(project_id);
