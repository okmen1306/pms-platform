-- 001_identity_tables.sql
-- Day 1 | identity-service (TL)
-- Kaynak: docs/roadmap.md Bölüm 4.1 — Dinamik Rol / İzin / Kullanıcı Override Modeli

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid() için

CREATE TABLE identity_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kod          TEXT UNIQUE NOT NULL,
  ad           TEXT NOT NULL,
  aciklama     TEXT,
  sistem_rolu  BOOLEAN NOT NULL DEFAULT FALSE,
  aktif        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE identity_users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role_id        UUID NOT NULL REFERENCES identity_roles(id),
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  personnel_id   UUID,
  dil_tercihi    TEXT NOT NULL DEFAULT 'tr' CHECK (dil_tercihi IN ('tr', 'en')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE identity_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION identity_check_super_admin_limit() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_super_admin = TRUE AND
     (SELECT COUNT(*) FROM identity_users WHERE is_super_admin = TRUE) >= 3 THEN
    RAISE EXCEPTION 'En fazla 3 super-admin kullanicisina izin verilir';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_super_admin_limit
  BEFORE INSERT OR UPDATE OF is_super_admin ON identity_users
  FOR EACH ROW WHEN (NEW.is_super_admin = TRUE)
  EXECUTE FUNCTION identity_check_super_admin_limit();

CREATE TABLE identity_refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE identity_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key TEXT UNIQUE NOT NULL,
  grup           TEXT NOT NULL,
  ad             TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE identity_role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES identity_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES identity_permissions(id) ON DELETE CASCADE,
  can_view      BOOLEAN DEFAULT FALSE,
  can_edit      BOOLEAN DEFAULT FALSE,
  UNIQUE (role_id, permission_id)
);

CREATE TABLE identity_user_permission_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES identity_permissions(id) ON DELETE CASCADE,
  can_view      BOOLEAN,
  can_edit      BOOLEAN,
  gerekce       TEXT,
  granted_by    UUID NOT NULL REFERENCES identity_users(id),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, permission_id)
);

CREATE OR REPLACE VIEW identity_effective_permissions AS
SELECT
  u.id AS user_id,
  p.permission_key,
  COALESCE(o.can_view, rp.can_view, FALSE) AS can_view,
  COALESCE(o.can_edit, rp.can_edit, FALSE) AS can_edit,
  (o.id IS NOT NULL) AS is_override
FROM identity_users u
JOIN identity_permissions p ON TRUE
LEFT JOIN identity_role_permissions rp ON rp.role_id = u.role_id AND rp.permission_id = p.id
LEFT JOIN identity_user_permission_overrides o
  ON o.user_id = u.id AND o.permission_id = p.id
  AND (o.expires_at IS NULL OR o.expires_at > NOW());

CREATE TABLE identity_password_resets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Rol silme kuralı: sistem_rolu=TRUE korumalıdır, uygulama katmanı (Day 5+) ROLE_IN_USE_CANNOT_DELETE
-- hatasını (bkz. shared/errors/domain.error.ts) kullanıcı taşınmadan silmeye izin vermeyerek üretir.
