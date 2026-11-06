-- 014_logger_tables.sql
-- Day 9 | logger-service (TL)
-- Kaynak: docs/roadmap.md Bölüm 4.11 ("Admin uçan kuştan bile haberdar olmalı")

-- Denetim kaydı: sistemdeki HER yazma işlemi (+ hassas okumalar) buraya akar. Append-only —
-- hiçbir rol (admin dahil) mevcut bir kaydı değiştiremez/silemez (bkz. 012_rls_policies.sql'deki
-- SADECE SELECT politikası; UPDATE/DELETE politikası KASITLI OLARAK yok, RLS varsayılanı reddeder).
CREATE TABLE logger_audit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service       TEXT NOT NULL,             -- 'project-service', 'finance-service', ...
  event_type    TEXT NOT NULL CHECK (event_type IN ('CREATE','UPDATE','DELETE','LOGIN','PERMISSION_CHANGE','VIEW_SENSITIVE')),
  actor_user_id UUID,                      -- islemi yapan kullanici (identity_users.id)
  actor_email   TEXT,
  entity_type   TEXT,                      -- 'project','employee','role','permission', vb.
  entity_id     UUID,
  ozet          TEXT NOT NULL,             -- "Aliye, Proje X'in 3. is paketini tamamladi" gibi okunabilir cumle
  onceki_deger  JSONB,
  yeni_deger    JSONB,
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  ip_adresi     INET,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_created_at ON logger_audit_events(created_at DESC);
CREATE INDEX idx_audit_actor ON logger_audit_events(actor_user_id);
CREATE INDEX idx_audit_entity ON logger_audit_events(entity_type, entity_id);

-- Teknik hata/log kayıtları (Telegram/Sentry'ye yönlendirilenler). Şema Day 9'da (audit ile aynı
-- bölümde tanımlı olduğu için) birlikte oluşturuldu ama HENÜZ KULLANILMIYOR — `log.event`
-- consumer'ı ve Telegram adaptörü Day 10'un kapsamı (bkz. docs/roadmap.md Bölüm 14.2 Day 10 satırı,
-- "logger-service: SSE broadcaster + Telegram adaptör").
CREATE TABLE logger_error_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service     TEXT NOT NULL,
  level       TEXT NOT NULL CHECK (level IN ('info','warning','error','fatal')),
  message     TEXT NOT NULL,
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE logger_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE logger_error_events ENABLE ROW LEVEL SECURITY;
