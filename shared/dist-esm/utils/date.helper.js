/**
 * Bu dosya, tarih/iş günü hesaplamasının TEK doğru kaynağının integration-service olduğu
 * kuralını (roadmap.md Bölüm 2 Kırılmaz Kural) kod seviyesinde hatırlatır: burada hesaplama
 * YAPILMAZ, sadece integration-service'e REST çağrısı yapan servislerin ortak arayüzü tanımlanır.
 * Her servis kendi tatil/iş günü mantığını yeniden yazarsa Kural #ihlali olur.
 */
export {};
