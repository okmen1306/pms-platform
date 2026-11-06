-- 012_rls_policies.sql
-- Bu dosya günler ilerledikçe kümülatif doldurulur (her gün ilgili servisin RLS politikası
-- eklenir). Kaynak: docs/roadmap.md Bölüm 11.

-- === Day 2 | Ortak yardımcı fonksiyon (docs/roadmap.md Bölüm 11.0) ===
-- identity_users / identity_effective_permissions (001_identity_tables.sql) üzerine kuruludur,
-- bu yüzden ilk kullanan servis (personnel-service, Day 2) bu dosyada tanımlıyor.
CREATE OR REPLACE FUNCTION has_permission(p_permission_key TEXT, p_need TEXT DEFAULT 'view')
RETURNS BOOLEAN AS $$
  SELECT
    (SELECT is_super_admin FROM identity_users WHERE id = auth.uid()) = TRUE
    OR EXISTS (
      SELECT 1 FROM identity_effective_permissions ep
      WHERE ep.user_id = auth.uid()
        AND ep.permission_key = p_permission_key
        AND ((p_need = 'view' AND ep.can_view) OR (p_need = 'edit' AND ep.can_edit))
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- === Day 2 | personnel_employees — Maaş Görünürlüğü (docs/roadmap.md Bölüm 11.1) ===
-- Not: Postgres'te kolon seviyesi RLS yoktur; bu politika SATIR erişimini kontrol eder.
-- maas_tl kolonunun izinsiz kullanıcılara null dönmesi UYGULAMA KATMANINDA yapılır
-- (bkz. services/personnel-service/src/core/use-cases/list-employees.usecase.ts toPublicEmployee).
CREATE POLICY "personnel_employees_select_all_authenticated"
  ON personnel_employees FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "personnel_employees_insert_hr_or_admin"
  ON personnel_employees FOR INSERT
  WITH CHECK (has_permission('personnel.salary', 'edit'));

CREATE POLICY "personnel_employees_update_hr_or_admin"
  ON personnel_employees FOR UPDATE
  USING (has_permission('personnel.salary', 'edit'));

-- === Day 6 | identity_roles / identity_user_permission_overrides (docs/roadmap.md Bölüm 11.5) ===
-- bkz. docs/testing/rls-test-plan.md Bölüm 11.5 için karşılık gelen test senaryoları.
ALTER TABLE identity_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "identity_roles_manage"
  ON identity_roles FOR ALL
  USING (has_permission('admin.roles.manage', 'edit'))
  WITH CHECK (has_permission('admin.roles.manage', 'edit'));

CREATE POLICY "identity_roles_select_authenticated"
  ON identity_roles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "identity_user_overrides_manage"
  ON identity_user_permission_overrides FOR ALL
  USING (has_permission('admin.roles.manage', 'edit'))
  WITH CHECK (has_permission('admin.roles.manage', 'edit'));

-- === Day 9 | project-service (Q) — project_projects (bkz. docs/roadmap.md Bölüm 11.3) ===
-- Not: `ekip_lideri_id` bir FK DEĞİL (bkz. Bölüm 2, "gösterim amaçlı düz UUID kolonu"), bu yüzden
-- JWT'nin `personnel_id` alanıyla (identity_users.id DEĞİL — personnel_employees.id) metin
-- karşılaştırması yapılır. Blokeri Day 7'de (personel atama) çözülmüştü, bugün (Day 9) yazıldı.
ALTER TABLE project_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proje gorme yetkisi"
  ON project_projects FOR SELECT
  USING (
    has_permission('project.all', 'view')
    OR ekip_lideri_id::text = auth.jwt() ->> 'personnel_id'
    OR EXISTS (
      SELECT 1 FROM project_personnel_assignments pa
      WHERE pa.project_id = project_projects.id
        AND pa.employee_id::text = auth.jwt() ->> 'personnel_id'
    )
  );

-- === Day 9 | logger-service (TL) — logger_audit_events (bkz. docs/roadmap.md Bölüm 11.6) ===
-- Denetim kaydini SADECE admin gozlem izni olanlar okuyabilir; hicbir rol duzenleyemez/silemez
-- (append-only, servisler sadece service-role key ile insert eder — bu yuzden INSERT/UPDATE/
-- DELETE icin ayrica bir politika YOK, RLS varsayilani reddeder; service-role key zaten RLS'i
-- bypass eder).
CREATE POLICY "Audit log sadece admin gozlem izniyle okunur"
  ON logger_audit_events FOR SELECT
  USING (has_permission('admin.audit_log', 'view'));
