-- 015_identity_must_change_password.sql
-- Day 22 | identity-service (TL) — G-02: yönetici/İK tarafından oluşturulan kullanıcı, geçici parolayla
-- gelir; ilk girişte kendi parolasını belirlemek ZORUNDA (web, bayrak açıkken yalnızca parola
-- değiştirme ekranını gösterir). Mevcut kullanıcılar etkilenmez (DEFAULT FALSE).
ALTER TABLE identity_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
