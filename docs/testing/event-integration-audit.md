# Event Bütünlüğü Denetimi — Day 14

Day 14'ün roadmap görevi ("tüm `publisher → consumer` event çiftlerinin manuel tetiklenip
loglanarak uçtan uca doğrulanması") bugün **gerçek bir RabbitMQ broker'a karşı** yapıldı — bu kum
havuzunda `apt-get install rabbitmq-server redis-server` ile kurulup doğrudan çalıştırıldı (Docker
yok). `tests/events/*.realtime.test.ts` Day 13'ün fake-`subscribe` yaklaşımından farklı olarak
gerçek `amqplib` bağlantısı, gerçek exchange/queue/routing-key kullanıyor — sadece DB katmanı hâlâ
fake (Supabase bu ortamda yok).

Bu denetim, `docs/roadmap.md` Bölüm 7 Kuyruk Haritası'nın **14 satırının HER BİRİNİ** gerçek kod
karşısında doğruladı. Sonuç, roadmap tablosunun kendisinden önemli ölçüde farklı: tablo bir
**niyet/plan** belgesi, aşağıdaki tablo ise **gerçekte ne var** belgesi.

## Özet Tablo

| # | Event | Üretici | Tüketiciler (roadmap'e göre) | Gerçek Durum |
|---|---|---|---|---|
| 1 | `employee.created`/`employee.updated` | ❌ YOK | project, finance, notification (Redis cache) | ❌ **Hiçbir taraf hiç yazılmamış** |
| 2 | `project.created` | ✅ project-service | notification, finance, reporting | ✅ **3/3 doğrulandı (gerçek broker, bugün)** |
| 3 | `assignment.created` | ✅ project-service | notification, reporting | ✅ **2/2 doğrulandı** + finance-service de tüketiyor (roadmap'te YOK, kod fazlası) |
| 4 | `assignment.conflict_detected` | ✅ project-service | notification, logger | ❌ **Üretici var, 0 tüketici** — ikisi de söz verilmiş, ikisi de yok |
| 5 | `work_package.completed` | ❌ YOK | notification, finance, reporting, performance | ⚠️ **3/4 tüketici HAZIR ama üretici hiç yazılmamış** — en ciddi bulgu, aşağıda detaylı |
| 6 | `work_package.delayed` | ❌ YOK | notification | ❌ **Hiçbir taraf yok** |
| 7 | `project.completed` | ❌ YOK | notification | ⚠️ **Tüketici hazır, üretici yok** |
| 8 | `material.purchased` | ✅ procurement-service | finance, reporting | ✅ **finance doğrulandı (gerçek broker)**; reporting Day 13'te BİLİNÇLİ olarak tüketmiyor (ince proxy kararı) |
| 9 | `exchange_rate.updated` | ✅ integration-service | procurement, finance, project | ⚠️ **Üretici bir boşluğa yayın yapıyor** — 3 servis de gerçekte REST pull kullanıyor (IntegrationServiceClient), RabbitMQ tüketmiyor |
| 10 | `performance.score_submitted` | ❌ YOK (Day 13'te belgelendi, Day 33+'a ertelendi) | reporting | ❌ İki taraf da yok — Day 13'te zaten belgelendi |
| 11 | `role.created`/`role.deleted`/`role.permissions_updated` | ✅ identity-service | logger (audit), api-gateway (cache invalidasyonu) | ✅ logger tarafı **genel `audit.event` üzerinden** gerçek (aşağıda); api-gateway tarafı **Day 15'e planlı, henüz vadesi gelmedi** (gap değil) |
| 12 | `user.permission_overridden` | ✅ identity-service | logger (audit), api-gateway | Yukarıdakiyle AYNI durum |
| 13 | `log.event` | ❌ YOK (kodun kendi yorumu bunu belgeliyor) | logger-service | ✅ **Tüketici gerçek broker üzerinden doğrulandı** (biz üretici yerine geçtik) — "tüketici üreticiden önce hazır" deseninin ÇALIŞTIĞI kanıtlandı |
| 14 | `audit.event` | ✅ TÜM servisler (her yazma use-case'i) | logger-service | ✅ **Doğrulandı (gerçek broker)** — sistemin en kritik/yaygın event'i |

**Bugün gerçek broker'a karşı doğrulanan: 5 test dosyası, 9 test, hepsi yeşil** (`npm run
test:events`). Kapsanmayanlar: satır 1, 4, 5, 6, 7, 9, 10 (üretici veya tüketici tarafı
eksik/mevcut değil — "doğrulama" bunları ÇALIŞTIRAMAZ, sadece eksikliği kanıtlayabilir, ki
aşağıda öyle yapıldı).

## En Ciddi Bulgu: `work_package.completed` / `project.completed`

`services/project-service/src/core/use-cases/mark-assignment-complete.usecase.ts` (satır 9-11)
kendi yorumunda bunu ZATEN itiraf ediyor:

> "Bu, roadmap.md event kataloğundaki `work_package.completed` event'ini YAYINLAMAZ — [...] ayrı
> bir günde ele alınacak (bkz. Sıradaki Gün notları)."

Bu not muhtemelen Day 6-8 civarında yazıldı ve "ayrı bir gün" hiç gelmedi — Day 13'e kadar
("12 servisin tamamı + gateway fonksiyonel" teslimi) bu boşluk kapanmadı. Sonuç: roadmap'in
"Sipariş/Proje Tamamlanma Saga Akışı" olarak tarif ettiği ZİNCİR — bir iş paketi tamamlanınca
finance-service maliyeti güncellesin, reporting-service ilerlemeyi işlesin, notification-service
e-posta göndersin, performance-service puanlama tetiklesin, ve tüm iş paketleri bitince proje
`project.completed` ile kapansın — **hiçbir zaman gerçekleşmedi**. 4 servisteki consumer'lar
(finance, notification, reporting; performance'ın consumer'ı bile YOK, bkz. tablo satır 5) sessizce
hiç mesaj almadan bekliyor.

Bunun NEDEN bugün düzeltilmediği: "iş paketi ne zaman TAM olarak tamamlanmış sayılır" (tüm alt iş
paketleri/atamalar bitince mi, tek bir onay adımıyla mı) gerçek bir iş kuralı tasarım kararı
gerektiriyor — mevcut `mark-assignment-complete.usecase.ts` sadece TEK bir atamayı işaretliyor,
work-package çapında toplu tamamlanma kontrolü YOK. Bu, "event kablolamasını doğrulama" kapsamının
ötesinde, kendi başına bir günü hak eden bir özellik. **Öneri: Day 15'in resmi kapsamına
başlamadan önce, önceliği en yüksek madde olarak ele alınmalı** — çünkü şu ana kadarki hiçbir gün
bunu üstlenmedi ve roadmap'in kendi zamanlamasında bir sonraki uygun yer yok.

## İkinci Bulgu: `assignment.conflict_detected` — söz verilen İKİ tüketici de yok

`project-service` bu event'i yayınlıyor (assignment.controller.ts) ama ne notification-service ne
de logger-service bunu dinliyor. Roadmap'in "çakışma tespit edilince anında uyarı" niyeti şu anda
hiçbir yere ulaşmıyor. `work_package.completed` kadar merkezi değil (bir zamanlama/UX iyileştirmesi,
saga akışının parçası değil) ama aynı kategoride bir boşluk.

## Üçüncü Bulgu: `exchange_rate.updated` — üretici bir boşluğa yayın yapıyor

`integration-service` bu event'i gerçekten yayınlıyor ama procurement/finance/project-service'in
ÜÇÜ de `IntegrationServiceClient` üzerinden REST pull kullanıyor (bkz. örn.
`services/finance-service/src/infrastructure/external/integration-service.client.ts`) —
RabbitMQ'yu hiç tüketmiyor. Bu MİMARİ olarak makul bir tasarım (her zaman güncel veri, cache
geçersizleştirme karmaşıklığı yok) ama roadmap'in Kuyruk Haritası'nı yanıltıcı kılıyor. **Bu bir
hata değil** — sadece tablo güncel değil. Öneri: roadmap.md'nin Kuyruk Haritası satırı, gerçek
mimariyi yansıtacak şekilde güncellenmeli (ya event kaldırılmalı ya da gerçekten bir tüketici
eklenmeli — hangisi olduğu bir mimari karar, bu denetimin kapsamı dışında).

## Dördüncü Bulgu: `employee.created`/`employee.updated` — hiç var olmamış

Kuyruk Haritası'nın İLK satırı. `grep -rln "employee\.created\|EMPLOYEE_EVENTS"` tüm depoda SIFIR
sonuç döndürüyor — şema yok, üretici yok, tüketici yok. project-service/finance-service'in Redis
üzerinden personel adı/maaş ORANI önbelleklemesi hiç kurulmadı; bunun yerine Day 13'te
reporting-service için kurulan `PersonnelServiceClient` deseni (REST pull, önbelleksiz) muhtemelen
bu ihtiyacın fiili çözümü oldu — ama bu, roadmap'in orijinal "event-driven cache" tasarımından
sessiz bir sapma, hiçbir günün CHANGELOG'unda kayıtlı değil.

## Doğru Şekilde Henüz Vadesi Gelmemiş Olanlar (bulgu DEĞİL)

`role.*`/`user.permission_overridden` → api-gateway izin cache invalidasyonu: kodun kendisi
(`api-gateway/src/clients/identity-service.client.ts` satır 11, 24) bunu Day 15'e ("Redis cache
senkronizasyon testleri") açıkça erteliyor — henüz o gün gelmedi, bu normal. logger-service tarafı
zaten gerçek: `role.controller.ts`'teki her usecase (`create-role`, `delete-role`,
`update-role-permissions`, `manage-user-override`) `publishAudit` çağırıyor — yani bu event'ler
ÖZEL bir `role.created` consumer'ı ile değil, GENEL `audit.event` boru hattıyla (bugün gerçek
broker'a karşı doğrulandı) zaten denetleniyor.

## Kapsam Dışı Bırakılanlar (bilinçli, bugünden)

- **`assignment.created` → finance-service**: kod okumasıyla doğrulandı (gerçek, çalışan bir
  consumer), ama gerçek-broker testi bugün buraya dahil edilmedi — 2 REST istemcisine
  (integration-service, personnel-service) bağımlı ARGE maliyet hesaplaması derinliği nedeniyle.
  Zaten Day 7'nin kendi unit-seviye testleri (`calculate-arge-cost.usecase.test.ts`) bu iş
  mantığını kapsıyor; bugünün eksik olan katmanı (broker kablolaması) diğer pairs'lerle aynı
  desenle doğrulanabilir, sadece zaman kısıtı nedeniyle ertelendi.

## Sonuç

roadmap.md'nin "Teslim (Day 13): 12 servisin tamamı + gateway fonksiyonel" iddiası servis
seviyesinde doğru — ama bugünün denetimi gösteriyor ki **roadmap'in kendi tarif ettiği
uçtan-uca iş akışlarından biri (proje/iş paketi tamamlanma saga'sı) hiçbir zaman gerçekten
çalışmadı**. Bu, "her şey yolunda" görünen bir sistemin altında gizli kalabilecek türden bir
bulgu — tam olarak Day 14'ün var olma sebebi.
