# RLS Test Planı — Gün Gün Kümülatif

Bu doküman, `docs/roadmap.md` Bölüm 11'deki her RLS politikası için "kim, neyi, ne zaman
görebilir/göremez" senaryolarını listeler. Gerçek Supabase test projesi kurulana kadar (go-live
öncesi, bkz. roadmap Bölüm 16) bu senaryolar `tests/rls/*.rls.test.ts` dosyalarında TODO
iskeletleri olarak durur; her senaryo yazıldığı gün burada da işaretlenir.

## Nasıl Çalışır

Her test dosyası gerçek bir Supabase test projesine (RLS aktif, service-role KULLANILMADAN,
gerçek kullanıcı JWT'siyle) bağlanır ve şu deseni izler:

```
1. Test kullanıcısı oluştur (belirli role_id ile)
2. O kullanıcının JWT'siyle bir SELECT/INSERT/UPDATE dene
3. Beklenen sonucu doğrula (izinliyse veri dönmeli, değilse boş/hata dönmeli)
```

## Senaryo Kataloğu

### 11.1 — personnel_employees (Maaş Görünürlüğü)

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | `personel` rolü kendi `personnel_employees` satırını okur | Satır döner, ama `maas_tl` uygulama katmanında `null` (backend Day 2'de doğrulandı, RLS testi Day 6'da eklendi) |
| 2 | `ik_yoneticisi` herhangi bir personelin maaşını okur | `maas_tl` gerçek değer olarak döner |
| 3 | `personel` rolü başka bir personelin kaydını okumaya çalışır | Satır döner (temel bilgi herkese açık), maaş yine `null` |
| 4 | Rolü olmayan/is_active=false kullanıcı herhangi bir isteği dener | Reddedilir (401, RLS'e erişemeden önce identity katmanında) |

**Durum:** Yazıldı (Day 6). Gerçek DB'ye karşı çalıştırma: Day 40+ (go-live hazırlığı).

### 11.2 — finance_project_costs (Maliyet Analizi)

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | `sirket_yoneticisi` (is_super_admin) herhangi bir projenin maliyetini okur | Satır döner |
| 2 | `ekip_lideri` kendi liderlik ettiği projenin maliyetini okur | REDDEDİLİR (RLS: sadece `finance.cost_analysis` izni olanlar) |
| 3 | `personel` maliyet tablosuna INSERT dener | REDDEDİLİR |

**Durum:** Yazıldı (Day 6). RLS politikası kendisi Day 9-10'da (finance-service tamamlanınca) eklenecek.

### 11.3 — project_projects (Proje Görünürlüğü)

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | `ekip_lideri` kendi liderlik ettiği projeyi okur | Satır döner |
| 2 | `ekip_lideri` başka bir ekip liderinin projesini okur | REDDEDİLİR |
| 3 | `personel`, dahil olduğu (assignment'ı olan) projeyi okur | Satır döner |
| 4 | `personel`, hiç dahil olmadığı bir projeyi okur | REDDEDİLİR |
| 5 | `sirket_yoneticisi` (`project.all` izniyle) tüm projeleri okur | Tüm satırlar döner |

**Durum:** Yazıldı (Day 9) — bkz. `tests/rls/project-visibility.rls.test.ts`. Politikanın kendisi
de bugün `012_rls_policies.sql`'e eklendi. Gerçek DB'ye karşı çalıştırma: Day 40+ (go-live hazırlığı).

### 11.4 — performance_employee_scores

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | Personel kendi puanını okur | Satır döner |
| 2 | Personel başka bir personelin puanını okur | REDDEDİLİR |
| 3 | `ekip_lideri` kendi projesindeki personelin puanını okur | Satır döner |

**Durum:** Yazıldı (Day 9) — bkz. `tests/rls/performance-scores.rls.test.ts`. Politikanın kendisi
roadmap'in kendi taahhüdü gereği HENÜZ eklenmedi (Day 33+).

### 11.5 — identity_roles / identity_user_permission_overrides

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | `admin.roles.manage` izni olmayan kullanıcı rol oluşturmayı dener | REDDEDİLİR |
| 2 | `is_super_admin=true` kullanıcı rol siler | İzin verilir (uygulama katmanı `sistem_rolu` kontrolünü ayrıca yapar, bkz. Day 3) |

**Durum:** Yazıldı (Day 6) — bu politika henüz migration'a eklenmedi, `012_rls_policies.sql`'e Day 6'da eklendi (bkz. aşağıdaki not).

### 11.6 — logger_audit_events (Append-Only Denetim Kaydı)

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | `admin.audit_log` izni olan kullanıcı okur | Satırlar döner |
| 2 | Herhangi bir kullanıcı (admin dahil) UPDATE/DELETE dener | REDDEDİLİR (append-only kuralı, sadece service-role INSERT edebilir) |

**Durum:** Taslak (Day 6) — logger-service henüz kurulmadı (Day 9-11 civarı planlanıyor).

## İlerleme Özeti

| Bölüm | Senaryo Sayısı | Durum |
|---|---|---|
| 11.1 Maaş | 4 | Yazıldı |
| 11.2 Maliyet | 3 | Yazıldı |
| 11.3 Proje Görünürlüğü | 5 | Taslak |
| 11.4 Performans | 3 | Taslak |
| 11.5 Rol/İzin | 2 | Yazıldı |
| 11.6 Audit Log | 2 | Taslak |
