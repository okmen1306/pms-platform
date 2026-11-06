# RBAC Matrisi (Day 21, G-01)

Gateway (`api-gateway`) her modül için bir izin anahtarı uygular: **GET/HEAD → `can_view`**, **POST/PUT/PATCH/DELETE → `can_edit`**.
`is_super_admin` her kapıyı geçer. Beklenen kodlar aşağıdaki tabloda; `api-gateway/src/__tests__/rbac-matrix.test.ts`
bu tabloyu **ayrıştırıp** gerçek gateway'e karşı her hücreyi dener (tablo ile kod ayrışırsa test kırılır).

Hücre: `okuma/yazma` yanıt kodu (`200` = geçti, `403` = `FORBIDDEN_PAGE_ACCESS`). Yazma, upstream'e gerçekten
ulaşan bir POST'tur (yan etkisiz stub'a).

<!-- RBAC-MATRIX:BEGIN -->
| Modül (rota) | Anahtar | sirket_yoneticisi | ekip_lideri | ik_yoneticisi | satinalma_personeli | personel |
|---|---|---|---|---|---|---|
| /project | project.records | 200/200 | 200/200 | 403/403 | 403/403 | 200/403 |
| /personnel | personnel.records | 200/200 | 200/403 | 200/200 | 403/403 | 403/403 |
| /personnel/employees/:id/salary | personnel.salary | 200/- | 403/- | 200/- | 403/- | 403/- |
| /procurement | procurement.materials | 200/200 | 403/403 | 403/403 | 200/200 | 403/403 |
| /performance | performance.score | 200/200 | 200/200 | 403/403 | 403/403 | 200/403 |
| /risk | risk.analysis | 200/200 | 200/200 | 403/403 | 403/403 | 200/403 |
| /reporting | reports.view | 200/200 | 200/403 | 403/403 | 403/403 | 403/403 |
| /finance | finance.cost_analysis | 200/200 | 403/403 | 403/403 | 403/403 | 403/403 |
| /notification | notification.templates | 200/200 | 403/403 | 403/403 | 403/403 | 403/403 |
| /integration | integration.holidays | 200/200 | 200/403 | 200/403 | 200/403 | 200/403 |
| /logger | admin.audit_log | 200/200 | 403/403 | 403/403 | 403/403 | 403/403 |
<!-- RBAC-MATRIX:END -->

## Notlar
- **`/identity/*` (admin.roles.manage):** yalnızca `sirket_yoneticisi`. `GET /identity/me/effective-permissions` bunun dışındadır:
  kimlikli herkes yalnızca **kendi** etkin izinlerini okur (kimlik JWT'den; parametre kabul etmez).
- **`/integration`:** okuma herkese açık (kur/iş günü proje sihirbazı için gerekli); yazma (`holidays`, kur override) `integration.holidays` ister.
- **`/logger` (admin.audit_log):** `sirket_yoneticisi` dışında kimseye varsayılan verilmez; yöntem ayrımı yok (her istek `view` ister).
- **Bilinen sınır (G-21):** `personel` için "yalnızca KENDİ görevleri/performansı" **satır seviyesi** bir kuraldır; anahtar seviyesinde
  ifade edilemez. Bugün `personel` proje/performans/risk için okuma anahtarına sahip ve kapsamı servisler/RLS belirliyor —
  gateway bunu daraltmaz. `docs/roadmap.md` 14.11'de G-21 olarak izlenir.
- **Canlı doğrulama (Day 22'de yapıldı):** `tests/integration/support/run-admin-verification.sh` bu tabloyu gerçek JWT'lerle
  (5 rol, gerçek identity-service + PostgreSQL/PostgREST + tüm servisler + gateway) **105 hücrede** dener — `live-admin-flow.mjs`.
  Ölçüt: "200" hücresi için kapı açık (401/403 DEĞİL; upstream 200/404/422/502 dönebilir), "403" hücresi için `FORBIDDEN_PAGE_ACCESS`.
  Gateway birim testi (`rbac-matrix.test.ts`, stub upstream) hızlı geri bildirim için durur.
- **Geçici parola:** `mustChangePassword` bayraklı token, parolasını değiştirene kadar YALNIZCA `POST /identity/me/password` ve
  `GET /identity/me/effective-permissions` uçlarına erişir; diğer her şey (süper admin dahil) 403 `PASSWORD_CHANGE_REQUIRED` —
  izin kapılarından ÖNCE devreye girer.
- **`/identity/users` (admin.users.manage):** yalnızca bu tam yol (liste + oluşturma) `ik_yoneticisi`'ne açık; alt yollar `admin.roles.manage`.
  Rol atamada yetki yükseltme `identity-service`'te engellenir (kendinde olmayan bir `admin.*` izni veren rol atanamaz).
