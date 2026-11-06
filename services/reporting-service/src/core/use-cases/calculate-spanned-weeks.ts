/**
 * B3 (Day 10): reporting-service'in workload snapshot'ı İÇİN basitleştirilmiş hafta hesabı.
 *
 * BİLİNÇLİ FARK (Uzman İnisiyatifi): finance-service'in AR-GE maliyeti hesabı hafta_no'yu
 * integration-service'in `GET /week-ranges` uç noktasından alır (iş günü/tatil hassasiyeti
 * ÖNEMLİ — para hesabı). Burada reporting-service için bu hassasiyet GEREKSİZ — bu tablo sadece
 * "kim hangi hafta ne kadar yüklü" görselleştirmesi için (Bölüm 4.10, `build-workload-matrix.
 * usecase.ts`), kesin bir mali hesaplama değil. integration-service'e ekstra bir REST bağımlılığı
 * eklemek yerine basit takvim haftası matematiği kullanıldı (7 günlük periyotlar, projenin
 * başlangıç tarihinden itibaren).
 */
export function calculateSpannedWeeks(projectStartDate: string, assignmentStart: string, assignmentEnd: string): number[] {
  const projectStart = new Date(projectStartDate);
  const start = new Date(assignmentStart);
  const end = new Date(assignmentEnd);

  const weekOf = (date: Date): number => {
    const diffDays = Math.floor((date.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(diffDays / 7) + 1);
  };

  const firstWeek = weekOf(start);
  const lastWeek = weekOf(end);

  const weeks: number[] = [];
  for (let w = firstWeek; w <= lastWeek; w++) {
    weeks.push(w);
  }
  return weeks;
}
