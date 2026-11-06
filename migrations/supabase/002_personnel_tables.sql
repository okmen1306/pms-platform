-- 002_personnel_tables.sql
-- Day 1 | personnel-service (B2)
-- Kaynak: docs/roadmap.md Bölüm 4.2

CREATE TABLE personnel_employees (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad                 TEXT NOT NULL,
  soyad              TEXT NOT NULL,
  email              TEXT UNIQUE NOT NULL,
  ise_baslama_tarihi DATE NOT NULL,
  maas_tl            NUMERIC(12,2) NOT NULL,     -- HASSAS ALAN, RLS Day 2'de eklenecek
  durum              TEXT NOT NULL DEFAULT 'active' CHECK (durum IN ('active','inactive')),
  olusturan_id       UUID NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE personnel_employees ENABLE ROW LEVEL SECURITY;

CREATE TABLE personnel_teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad          TEXT UNIQUE NOT NULL,
  aciklama    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE personnel_team_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES personnel_teams(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES personnel_employees(id) ON DELETE RESTRICT,
  sorumluluk        TEXT,
  baslangic_tarihi  DATE NOT NULL DEFAULT CURRENT_DATE,
  bitis_tarihi      DATE,
  aktif             BOOLEAN DEFAULT TRUE,
  UNIQUE (team_id, employee_id, baslangic_tarihi)
);

CREATE INDEX idx_team_members_employee ON personnel_team_members(employee_id);

-- Seed (Day 17'de tam liste yüklenecek):
-- Yonetim, Satin Alma, Mekanik, Elektronik, Yazilim, Atolye, VSM/HEMS, LT, AFM,
-- Uretim ve Montaj, Kalite, Satis ve Pazarlama, Muhasebe, Proje
