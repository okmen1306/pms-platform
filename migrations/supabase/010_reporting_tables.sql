-- 010_reporting_tables.sql
-- Day 10 | reporting-service (B3) — CQRS şeması + ilk consumer'lar
-- Kaynak: docs/roadmap.md Bölüm 4.10. Bu tablolar event'lerden BESLENİR (event-carried state
-- transfer) — reporting-service'in kendi yazma API'si YOKTUR, sadece project/personnel/finance
-- servislerinin event'lerini dinleyip kendi "okuma modeli"ni inşa eder (Bölüm 2'deki CQRS kuralı).

CREATE TABLE reporting_project_progress (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL,
  work_package_id       UUID,
  employee_id           UUID,
  tamamlanma_yuzdesi    NUMERIC(5,2) DEFAULT 0,
  baslangic_tarihi      DATE,
  bitis_tarihi          DATE,
  guncelleme_zamani     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, work_package_id, employee_id)
);

CREATE TABLE reporting_workload_snapshot (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL,
  hafta_no     INTEGER NOT NULL,
  project_id   UUID NOT NULL,
  work_package_id UUID NOT NULL,
  guncelleme   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_workload_snapshot_employee_week ON reporting_workload_snapshot(employee_id, hafta_no);

CREATE TABLE reporting_project_planner_snapshot (
  project_id        UUID PRIMARY KEY,
  proje_adi          TEXT NOT NULL,
  planlanan_baslangic DATE,
  planlanan_sure_hafta INTEGER,
  fiili_baslangic     DATE,
  fiili_sure_hafta     INTEGER,
  tamamlanma_yuzdesi   NUMERIC(5,2),
  guncelleme           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reporting_project_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting_workload_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting_project_planner_snapshot ENABLE ROW LEVEL SECURITY;
