-- 013_seed_data.sql
-- Day 17 | Tüm Backend Ekip — roadmap.md Bölüm 14.4: "Seed data script'leri: master iş
-- paketleri, ekipler, izin kataloğu, e-posta şablonları (TR/EN)".
--
-- Bu dosya Day 0'dan beri placeholder'dı (bkz. CHANGELOG.md Day 0): Supabase kurulumu bilinçli
-- olarak projenin sonuna bırakıldığı için SQL, ilgili servisin geliştirildiği günde dolduruluyor
-- (roadmap.md Bölüm 14.2). "Master iş paketleri" kalemi aslında BURADA DEĞİL — Day 5'te
-- `003_project_tables.sql`'in kendi içinde, tablosuyla BİRLİKTE zaten seed edildi (o dosyadaki
-- Day 5 yorumu: "kurum-değişmez referans verisi olduğu için 013_seed_data.sql'i (Day 17)
-- beklemeden burada seed edildi"). Yani bugünün GERÇEK kapsamı, roadmap'in Day 17 satırının
-- geri kalanı: ekipler + izin kataloğu + e-posta şablonları (TR/EN).
--
-- Kaynak disiplini: aşağıdaki HİÇBİR satır icat edilmedi. Roller ve varsayılan kısıtları
-- docs/roadmap.md satır 43-49'daki "Rol (seed)" tablosundan birebir; izin anahtarları
-- shared/dto/permission.dto.ts'teki PERMISSION_KEYS sabitinden (kodun KENDİSİ zaten import
-- ediyor, burada elle tekrar yazılmadı); e-posta şablon kodları ve {{değişken}} isimleri
-- notification-service'in 5 send-*-email.usecase.ts dosyasındaki TEMPLATE_CODE sabitlerinden ve
-- gerçek `context` nesnelerinden birebir.

-- ============================================================================
-- 2) Roller (identity_roles) — docs/roadmap.md satır 43-49, "Rol (seed)" tablosu, BİREBİR.
--
-- NOT (roadmap tutarsızlığı, Day 16'nın çapraz-review bulgularıyla AYNI türden): roadmap.md
-- satır 1484'te "POST /projects (satis + sirket_yoneticisi)" diye bir yetki listesi var, ama
-- "satis" (satış) rolü bu 5 satırlık kanonik "Rol (seed)" tablosunda YOK, kodda (grep: sıfır
-- sonuç) hiçbir yerde tanımlı değil, ve identity_permissions'ta karşılık gelen bir izin de yok.
-- Tek, izole bir satırdan 6. bir rol icat etmek yerine (kanıtlanmamış bir varsayım olurdu) bu
-- KARARA BAĞLANDI (Day 21): `satis` rolü yok; roadmap'teki "satis" yetkisi `sirket_yoneticisi`'ne verilir — CHANGELOG.md Day 21. project-service'in
-- kendi create-project.usecase.ts'i şu an ZATEN rol bazlı yetki kontrolü yapmıyor (Day 2 stub'ı,
-- `getCallerPermissions` her yerde `[]` döner), yani bu tutarsızlığın bugün çalışma zamanında
-- hiçbir etkisi yok.
-- ============================================================================
INSERT INTO identity_roles (kod, ad, aciklama, sistem_rolu) VALUES
  ('sirket_yoneticisi',   'Şirket Yöneticisi / Süper Admin',
   'Tüm ekranlar, tüm raporlar, maliyet analizi, rol/izin yönetimi, sistem geneli izleme. Silinemez sistem rolüdür.',
   TRUE),
  ('ekip_lideri',         'Ekip Lideri',
   'Maaşları, maliyet analiz raporlarını, kendi personeli olmayanların performansını, dahil olmadığı projeleri göremez.',
   FALSE),
  ('ik_yoneticisi',       'İnsan Kaynakları Yöneticisi',
   'Personel CRUD + inactive yapma. Yöneticiler dışında maaşı görebilen tek rol.',
   FALSE),
  ('satinalma_personeli', 'Satın Alma / Depo Personeli',
   'Malzeme girişi ve stok takibi. 2-3 kişilik grup.',
   FALSE),
  ('personel',            'Personel',
   'Kendi görevleri, kendi performansı, dahil olduğu projenin risk analizi.',
   FALSE);

-- ============================================================================
-- 3) İzin kataloğu + rol -> izin matrisi — TEK KAYNAK: shared/dto/permission-catalog.ts
-- (roller yukarıda eklendi; matris rol koduna göre JOIN'lenir). Aşağıdaki blok üretilir.
-- ============================================================================
-- BEGIN GENERATED: permission-catalog (shared/dto/permission-catalog.ts) — ELLE DÜZENLEME
INSERT INTO identity_permissions (permission_key, grup, ad) VALUES
  ('admin.roles.manage', 'Admin', 'Rol ve izin yönetimi'),
  ('admin.audit_log', 'Admin', 'Denetim kaydı görüntüleme'),
  ('admin.users.manage', 'Admin', 'Kullanıcı yönetimi'),
  ('personnel.salary', 'Personel', 'Personel maaş bilgisi görüntüleme'),
  ('personnel.records', 'Personel', 'Personel kayıtları (liste, ekip, pasife alma)'),
  ('project.all', 'Proje', 'Tüm projelere erişim'),
  ('project.records', 'Proje', 'Proje, iş paketi ve atama kayıtları'),
  ('finance.cost_analysis', 'Finans', 'Finansal maliyet analizi'),
  ('performance.all', 'Performans', 'Tüm performans verilerine erişim'),
  ('performance.score', 'Performans', 'Performans puanlama'),
  ('risk.analysis', 'Risk', 'Risk analizi'),
  ('procurement.materials', 'Satın Alma', 'Malzeme girişi ve stok takibi'),
  ('reports.view', 'Raporlar', 'Raporları görüntüleme'),
  ('integration.holidays', 'Entegrasyon', 'Resmî tatil ve kur override yönetimi'),
  ('notification.templates', 'Bildirim', 'E-posta şablonu yönetimi');

-- Rol -> izin matrisi: 5 rol × tüm izinler, her hücre açık (rol_kod, izin, can_view, can_edit).
INSERT INTO identity_role_permissions (role_id, permission_id, can_view, can_edit)
SELECT r.id, p.id, g.can_view, g.can_edit
FROM (VALUES
  ('sirket_yoneticisi', 'admin.roles.manage', TRUE, TRUE),
  ('sirket_yoneticisi', 'admin.audit_log', TRUE, TRUE),
  ('sirket_yoneticisi', 'admin.users.manage', TRUE, TRUE),
  ('sirket_yoneticisi', 'personnel.salary', TRUE, TRUE),
  ('sirket_yoneticisi', 'personnel.records', TRUE, TRUE),
  ('sirket_yoneticisi', 'project.all', TRUE, TRUE),
  ('sirket_yoneticisi', 'project.records', TRUE, TRUE),
  ('sirket_yoneticisi', 'finance.cost_analysis', TRUE, TRUE),
  ('sirket_yoneticisi', 'performance.all', TRUE, TRUE),
  ('sirket_yoneticisi', 'performance.score', TRUE, TRUE),
  ('sirket_yoneticisi', 'risk.analysis', TRUE, TRUE),
  ('sirket_yoneticisi', 'procurement.materials', TRUE, TRUE),
  ('sirket_yoneticisi', 'reports.view', TRUE, TRUE),
  ('sirket_yoneticisi', 'integration.holidays', TRUE, TRUE),
  ('sirket_yoneticisi', 'notification.templates', TRUE, TRUE),
  ('ekip_lideri', 'admin.roles.manage', FALSE, FALSE),
  ('ekip_lideri', 'admin.audit_log', FALSE, FALSE),
  ('ekip_lideri', 'admin.users.manage', FALSE, FALSE),
  ('ekip_lideri', 'personnel.salary', FALSE, FALSE),
  ('ekip_lideri', 'personnel.records', TRUE, FALSE),
  ('ekip_lideri', 'project.all', FALSE, FALSE),
  ('ekip_lideri', 'project.records', TRUE, TRUE),
  ('ekip_lideri', 'finance.cost_analysis', FALSE, FALSE),
  ('ekip_lideri', 'performance.all', FALSE, FALSE),
  ('ekip_lideri', 'performance.score', TRUE, TRUE),
  ('ekip_lideri', 'risk.analysis', TRUE, TRUE),
  ('ekip_lideri', 'procurement.materials', FALSE, FALSE),
  ('ekip_lideri', 'reports.view', TRUE, FALSE),
  ('ekip_lideri', 'integration.holidays', FALSE, FALSE),
  ('ekip_lideri', 'notification.templates', FALSE, FALSE),
  ('ik_yoneticisi', 'admin.roles.manage', FALSE, FALSE),
  ('ik_yoneticisi', 'admin.audit_log', FALSE, FALSE),
  ('ik_yoneticisi', 'admin.users.manage', TRUE, TRUE),
  ('ik_yoneticisi', 'personnel.salary', TRUE, TRUE),
  ('ik_yoneticisi', 'personnel.records', TRUE, TRUE),
  ('ik_yoneticisi', 'project.all', FALSE, FALSE),
  ('ik_yoneticisi', 'project.records', FALSE, FALSE),
  ('ik_yoneticisi', 'finance.cost_analysis', FALSE, FALSE),
  ('ik_yoneticisi', 'performance.all', FALSE, FALSE),
  ('ik_yoneticisi', 'performance.score', FALSE, FALSE),
  ('ik_yoneticisi', 'risk.analysis', FALSE, FALSE),
  ('ik_yoneticisi', 'procurement.materials', FALSE, FALSE),
  ('ik_yoneticisi', 'reports.view', FALSE, FALSE),
  ('ik_yoneticisi', 'integration.holidays', FALSE, FALSE),
  ('ik_yoneticisi', 'notification.templates', FALSE, FALSE),
  ('satinalma_personeli', 'admin.roles.manage', FALSE, FALSE),
  ('satinalma_personeli', 'admin.audit_log', FALSE, FALSE),
  ('satinalma_personeli', 'admin.users.manage', FALSE, FALSE),
  ('satinalma_personeli', 'personnel.salary', FALSE, FALSE),
  ('satinalma_personeli', 'personnel.records', FALSE, FALSE),
  ('satinalma_personeli', 'project.all', FALSE, FALSE),
  ('satinalma_personeli', 'project.records', FALSE, FALSE),
  ('satinalma_personeli', 'finance.cost_analysis', FALSE, FALSE),
  ('satinalma_personeli', 'performance.all', FALSE, FALSE),
  ('satinalma_personeli', 'performance.score', FALSE, FALSE),
  ('satinalma_personeli', 'risk.analysis', FALSE, FALSE),
  ('satinalma_personeli', 'procurement.materials', TRUE, TRUE),
  ('satinalma_personeli', 'reports.view', FALSE, FALSE),
  ('satinalma_personeli', 'integration.holidays', FALSE, FALSE),
  ('satinalma_personeli', 'notification.templates', FALSE, FALSE),
  ('personel', 'admin.roles.manage', FALSE, FALSE),
  ('personel', 'admin.audit_log', FALSE, FALSE),
  ('personel', 'admin.users.manage', FALSE, FALSE),
  ('personel', 'personnel.salary', FALSE, FALSE),
  ('personel', 'personnel.records', FALSE, FALSE),
  ('personel', 'project.all', FALSE, FALSE),
  ('personel', 'project.records', TRUE, FALSE),
  ('personel', 'finance.cost_analysis', FALSE, FALSE),
  ('personel', 'performance.all', FALSE, FALSE),
  ('personel', 'performance.score', TRUE, FALSE),
  ('personel', 'risk.analysis', TRUE, FALSE),
  ('personel', 'procurement.materials', FALSE, FALSE),
  ('personel', 'reports.view', FALSE, FALSE),
  ('personel', 'integration.holidays', FALSE, FALSE),
  ('personel', 'notification.templates', FALSE, FALSE)
) AS g(rol_kod, permission_key, can_view, can_edit)
JOIN identity_roles r ON r.kod = g.rol_kod
JOIN identity_permissions p ON p.permission_key = g.permission_key;
-- END GENERATED: permission-catalog

-- ============================================================================
-- 4) Ekipler (personnel_teams) — üyelik (personnel_team_members) SEED EDİLMEDİ: henüz gerçek
-- bir personnel_employees satırı yok (personel kaydı, ik_yoneticisi tarafından uygulamadan
-- girilecek operasyonel veri — bu sabit referans verisinin kapsamına girmiyor, madde 9).
-- Takım adları icat edilmedi: docs/roadmap.md'nin project_master_work_packages'ta (Day 5,
-- 003_project_tables.sql) ZATEN seed edilmiş "Dizayn" alt kalemlerinden (Mekanik Aksam
-- Tasarımı, Kontrol ve Ölçüm Elektroniği Tasarımı, Yazılım Tasarımı) ve üst kalemlerinden
-- (Satın Alma, Üretim/İmalat, Kalite Kontrol) BİREBİR türetildi — bu şirketin gerçek
-- fonksiyonel birimleri zaten o tabloda ima ediliyordu.
-- ============================================================================
INSERT INTO personnel_teams (ad, aciklama) VALUES
  ('Mekanik Tasarım',       'Mekanik aksam tasarımı ve mühendisliği.'),
  ('Elektronik ve Kontrol', 'Kontrol ve ölçüm elektroniği tasarımı.'),
  ('Yazılım Geliştirme',    'Gömülü/masaüstü yazılım tasarımı ve geliştirmesi.'),
  ('Satın Alma',            'Malzeme tedariki ve tedarikçi ilişkileri.'),
  ('Üretim',                'İmalat, sistem kurulum ve deneme.'),
  ('Kalite Kontrol',        'Test, iyileştirme ve kalite kontrol süreçleri.');

-- ============================================================================
-- 5) E-posta şablonları (notification_email_templates), TR + EN — kodlar ve {{değişken}}
-- adları notification-service'in 5 send-*-email.usecase.ts dosyasındaki TEMPLATE_CODE
-- sabitlerinden ve gerçek `context` nesnelerinden BİREBİR (send-templated-email.usecase.ts'in
-- renderer'ı: basit `{{degisken}}` regex interpolasyonu, hem `konu` hem `govde_html` için).
-- TÜM gönderim kodu şu an `dil: 'tr'` sabit geçiyor (kullanıcının `dil_tercihi`si henüz
-- okunmuyor) — bu satır bir Day 17 bulgusu, CHANGELOG.md'de not edildi; EN satırları yine de
-- şemanın (Bölüm 4.9: "dil TEXT CHECK (dil IN ('tr','en'))") istediği gibi seed edildi.
-- ============================================================================
INSERT INTO notification_email_templates (kod, dil, konu, govde_html) VALUES
  ('PROJECT_START', 'tr',
   'Proje Başladı: {{baslangicTarihi}}',
   '<p>Merhaba {{adSoyad}},</p><p>Ekip liderliğini yaptığınız proje {{baslangicTarihi}} tarihinde başladı ve {{bitisTarihi}} tarihinde tamamlanması planlanıyor.</p>'),
  ('PROJECT_START', 'en',
   'Project Started: {{baslangicTarihi}}',
   '<p>Hello {{adSoyad}},</p><p>The project you lead started on {{baslangicTarihi}} and is planned to finish on {{bitisTarihi}}.</p>'),

  ('WORK_ASSIGNED', 'tr',
   'Yeni Görev Ataması',
   '<p>Merhaba {{adSoyad}},</p><p>Projede yeni bir göreve atandınız. Başlangıç: {{baslangicTarihi}}, bitiş: {{bitisTarihi}} ({{gunSayisi}} gün).</p>'),
  ('WORK_ASSIGNED', 'en',
   'New Task Assignment',
   '<p>Hello {{adSoyad}},</p><p>You have been assigned a new task. Start: {{baslangicTarihi}}, end: {{bitisTarihi}} ({{gunSayisi}} days).</p>'),

  ('DELAY_WARNING', 'tr',
   'Gecikme Uyarısı',
   '<p>Merhaba {{adSoyad}},</p><p>Bitiş tarihi {{bitisTarihi}} olan göreviniz {{gecikmeGunSayisi}} gündür gecikmiş durumda. Lütfen en kısa sürede güncelleyin.</p>'),
  ('DELAY_WARNING', 'en',
   'Delay Warning',
   '<p>Hello {{adSoyad}},</p><p>Your task due on {{bitisTarihi}} is {{gecikmeGunSayisi}} day(s) overdue. Please update it as soon as possible.</p>'),

  ('WORK_FINISHED', 'tr',
   'Görev Tamamlandı',
   '<p>Merhaba {{adSoyad}},</p><p>Göreviniz {{tamamlanmaDurumu}} olarak tamamlandı.</p>'),
  ('WORK_FINISHED', 'en',
   'Task Completed',
   '<p>Hello {{adSoyad}},</p><p>Your task has been completed ({{tamamlanmaDurumu}}).</p>'),

  ('PROJECT_COMPLETED', 'tr',
   'Proje Tamamlandı: {{projeAdi}}',
   '<p>{{projeAdi}} projesi {{tamamlanmaTarihi}} tarihinde tamamlanmıştır. Emeği geçen herkese teşekkür ederiz.</p>'),
  ('PROJECT_COMPLETED', 'en',
   'Project Completed: {{projeAdi}}',
   '<p>The project {{projeAdi}} was completed on {{tamamlanmaTarihi}}. Thank you to everyone involved.</p>');
