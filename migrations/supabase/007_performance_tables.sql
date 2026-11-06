-- 007_performance_tables.sql
-- Day 1 | performance-service (B3)
-- Kaynak: docs/roadmap.md Bölüm 4.7

CREATE TABLE performance_criteria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad              TEXT UNIQUE NOT NULL,
  agirlik_yuzdesi NUMERIC(5,2) NOT NULL CHECK (agirlik_yuzdesi > 0),
  aktif           BOOLEAN DEFAULT TRUE
);

CREATE TABLE performance_employee_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL,
  employee_id    UUID NOT NULL,
  criterion_id   UUID NOT NULL REFERENCES performance_criteria(id),
  puan           NUMERIC(5,2) NOT NULL CHECK (puan BETWEEN 0 AND 100),
  veren_id       UUID NOT NULL,
  verilme_tarihi TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, employee_id, criterion_id)
);

CREATE TABLE performance_team_lead_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL,
  ekip_lideri_id    UUID NOT NULL,
  criterion_id      UUID NOT NULL REFERENCES performance_criteria(id),
  puan              NUMERIC(5,2) NOT NULL CHECK (puan BETWEEN 0 AND 100),
  veren_yonetici_id UUID NOT NULL,
  updated_by        UUID,
  updated_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, ekip_lideri_id, criterion_id)
);

CREATE TABLE performance_employee_indices (
  employee_id   UUID NOT NULL,
  project_id    UUID NOT NULL,
  endeks_puani  NUMERIC(6,2) NOT NULL,
  guncelleme    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (employee_id, project_id)
);

CREATE TABLE performance_team_indices (
  team_id       UUID NOT NULL,
  project_id    UUID NOT NULL,
  endeks_puani  NUMERIC(6,2) NOT NULL,
  guncelleme    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, project_id)
);
