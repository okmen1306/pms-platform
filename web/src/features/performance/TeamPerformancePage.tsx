import { EmptyState } from '../../shared/components/EmptyState';

/**
 * F2 (Day 10): "Performance tamamlama" (docs/roadmap.md Bölüm 14.3 satır 10).
 *
 * DÜRÜST DURUM (Uzman İnisiyatifi): `TeamPerformancePage` ekip lideri puanlarını ve ekip
 * endeksini göstermesi gereken bir sayfa — ama backend'i YOK. `performance_team_lead_scores`
 * ve `performance_team_indices` tabloları var (007_performance_tables.sql) ama bunlara yazan
 * hiçbir use-case yok: `score.repository.ts`'in `submitTeamLeadScore`'u hâlâ "henüz implemente
 * edilmedi" hatası fırlatıyor (bkz. o dosyadaki Day 9/10 notu — master takvimde performance-
 * service'e ekip liderliği puanlama/endeks hesaplama işi HİÇBİR güne atanmamış).
 *
 * Sahte veri göstermek veya çalışmayan bir form sunmak yerine bu sayfa BUNU AÇIKÇA söylüyor —
 * EmployeePerformancePage'in (aynı gün eklenen, gerçek backend'i olan) yanına, "tamamlama"
 * kapsamının nerede durduğunu net göstermek için.
 */
export function TeamPerformancePage() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Ekip Performansı</h1>
      <EmptyState
        title="Bu özellik henüz hazır değil"
        description="Ekip lideri puanlama ve ekip endeksi hesaplaması backend'de henüz implemente edilmedi — master takvimde bu işe henüz bir gün ayrılmadı."
      />
    </div>
  );
}
