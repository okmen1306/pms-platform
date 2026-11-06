-- 009_notification_tables.sql
-- Day 4 | notification-service (B3)
-- Kaynak: docs/roadmap.md Bölüm 4.9

CREATE TABLE notification_email_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kod        TEXT NOT NULL,
  dil        TEXT NOT NULL CHECK (dil IN ('tr','en')),
  konu       TEXT NOT NULL,
  govde_html TEXT NOT NULL,
  UNIQUE (kod, dil)
);

CREATE TABLE notification_email_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alici_email     TEXT NOT NULL,
  sablon_kodu     TEXT NOT NULL,
  proje_id        UUID,
  context         JSONB,
  gonderim_zamani TIMESTAMPTZ DEFAULT NOW(),
  durum           TEXT DEFAULT 'sent' CHECK (durum IN ('sent','failed','queued')),
  hata_mesaji     TEXT
);

CREATE TABLE notification_scheduled_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_tipi         TEXT NOT NULL,
  ilgili_kayit_id  UUID NOT NULL,
  calisacagi_zaman TIMESTAMPTZ NOT NULL,
  calisti_mi       BOOLEAN DEFAULT FALSE
);
