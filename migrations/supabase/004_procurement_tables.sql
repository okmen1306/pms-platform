-- 004_procurement_tables.sql
-- Day 4 | procurement-service (B2)
-- Kaynak: docs/roadmap.md Bölüm 4.4

CREATE TABLE procurement_materials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL,
  malzeme_turu        TEXT NOT NULL,
  malzeme_adi         TEXT NOT NULL,
  teknik_ozellik      TEXT,
  adet                NUMERIC(10,2) NOT NULL CHECK (adet > 0),
  birim_fiyat         NUMERIC(12,2) NOT NULL CHECK (birim_fiyat >= 0),
  alim_tarihi         DATE NOT NULL,
  alim_dolar_kuru     NUMERIC(10,4) NOT NULL,
  kur_manuel_override BOOLEAN DEFAULT FALSE,
  toplam_tl           NUMERIC(14,2) GENERATED ALWAYS AS (adet * birim_fiyat) STORED,
  toplam_usd          NUMERIC(14,2) GENERATED ALWAYS AS (adet * birim_fiyat / NULLIF(alim_dolar_kuru,0)) STORED,
  olusturan_id        UUID NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE procurement_stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   UUID NOT NULL REFERENCES procurement_materials(id) ON DELETE CASCADE,
  hareket_tipi  TEXT NOT NULL CHECK (hareket_tipi IN ('giris','cikis')),
  miktar        NUMERIC(10,2) NOT NULL,
  aciklama      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_procurement_materials_project ON procurement_materials(project_id);
