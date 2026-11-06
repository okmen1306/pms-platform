-- 008_risk_tables.sql
-- Day 3 | risk-service (B3)
-- Kaynak: docs/roadmap.md Bölüm 4.8

CREATE TABLE risk_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL,
  work_package_id     UUID,
  sub_work_package_id UUID,
  risk_adi            TEXT NOT NULL,
  aciklama            TEXT,
  olasilik            SMALLINT NOT NULL CHECK (olasilik BETWEEN 1 AND 5),
  etki                SMALLINT NOT NULL CHECK (etki BETWEEN 1 AND 5),
  oncelik_puani       SMALLINT GENERATED ALWAYS AS (olasilik * etki) STORED,
  azaltma_stratejisi  TEXT,
  durum               TEXT DEFAULT 'acik' CHECK (durum IN ('acik','izleniyor','kapandi')),
  olusturan_id        UUID NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_project ON risk_items(project_id);
