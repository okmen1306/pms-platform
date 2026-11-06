-- 005_integration_tables.sql
-- Day 1 | integration-service (B1)
-- Kaynak: docs/roadmap.md Bölüm 4.5

CREATE TABLE integration_exchange_rates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarih          DATE UNIQUE NOT NULL,
  usd_try        NUMERIC(10,4) NOT NULL,
  kaynak         TEXT NOT NULL DEFAULT 'TCMB',
  cekilme_zamani TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE integration_public_holidays (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarih      DATE UNIQUE NOT NULL,
  aciklama   TEXT NOT NULL,
  yil        INTEGER NOT NULL,
  yarim_gun  BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_holidays_yil ON integration_public_holidays(yil);
