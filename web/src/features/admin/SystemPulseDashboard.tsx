import { useQuery } from '@tanstack/react-query';
import { fetchSystemPulse } from './activity.api';

function Card({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold ${tone === 'warn' ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

/** Day 22 (madde 4): 30 sn'de bir yenilenen sistem nabzı. Geciken iş paketi verisi yoksa 0 DEĞİL "Veri yok" (G-27). */
export function SystemPulseDashboard() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['system-pulse'], queryFn: fetchSystemPulse, refetchInterval: 30_000 });

  if (isLoading) return <p className="text-xs text-gray-500">Sistem nabzı yükleniyor...</p>;
  if (isError || !data) return <p className="text-xs text-red-600">{error instanceof Error ? error.message : 'Sistem nabzı alınamadı'}</p>;

  return (
    <section aria-label="Sistem nabzı" className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Bugünkü işlem" value={String(data.todayActions)} />
        <Card label="Aktif kullanıcı (bugün)" value={String(data.activeUsersToday)} />
        <Card label="Son 24s oluşan" value={String(data.last24h.created)} />
        <Card label="Son 24s silinen" value={String(data.last24h.deleted)} />
        <Card label="Son 24s uyarı" value={String(data.last24h.warnings)} tone={data.last24h.warnings > 0 ? 'warn' : undefined} />
        <Card label="Son 24s izin değişikliği" value={String(data.last24h.permissionChanges)} />
        <Card
          label="Geciken iş paketi"
          value={data.delayedWorkPackages === null ? 'Veri yok' : String(data.delayedWorkPackages)}
          hint={data.delayedWorkPackages === null ? 'Bu veri henüz bağlı değil' : undefined}
        />
      </div>
      {data.truncated && <p className="text-xs text-amber-700">Kayıt sayısı sınırı aşıldı; sayılar alt sınırdır.</p>}
    </section>
  );
}
