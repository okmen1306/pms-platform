import type { WorkflowStatusEntry } from './reporting.api';

export interface GanttBar {
  label: string;
  /** Çubuğun zaman ekseninde başladığı yer (0-100). */
  leftPct: number;
  /** Çubuk genişliği (0-100); en az 1 gün görünür. */
  widthPct: number;
  /** Tamamlanan kısım, çubuğun yüzdesi (0-100). */
  progressPct: number;
  durum: WorkflowStatusEntry['durum'];
}

const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(d.length === 10 ? `${d}T00:00:00Z` : d);

/**
 * Day 21 (F2): saf yerleşim hesabı (DOM'dan bağımsız, birim testli). Tarihi eksik/geçersiz girişler
 * (henüz planlanmamış atama) ÇİZİLMEZ ve `skipped` olarak sayılır — sayfa bunu kullanıcıya bildirir
 * (sessizce kaybolmaz). Bitiş <= başlangıç ise çubuk 1 gün genişliğe sabitlenir.
 */
export function computeGanttBars(entries: WorkflowStatusEntry[]): { bars: GanttBar[]; rangeStart: string | null; rangeEnd: string | null; skipped: number } {
  const dated = entries
    .map((e) => ({ e, s: e.baslangicTarihi ? toMs(e.baslangicTarihi) : NaN, f: e.bitisTarihi ? toMs(e.bitisTarihi) : NaN }))
    .filter((x) => Number.isFinite(x.s) && Number.isFinite(x.f));
  const skipped = entries.length - dated.length;
  if (dated.length === 0) return { bars: [], rangeStart: null, rangeEnd: null, skipped };

  const min = Math.min(...dated.map((x) => x.s));
  const max = Math.max(...dated.map((x) => Math.max(x.f, x.s + DAY)));
  const span = max - min;
  const bars = dated.map(({ e, s, f }) => {
    const end = Math.max(f, s + DAY);
    return {
      label: [e.workPackageName ?? e.workPackageId ?? '—', e.employeeName ?? e.employeeId].filter(Boolean).join(' · '),
      leftPct: ((s - min) / span) * 100,
      widthPct: ((end - s) / span) * 100,
      progressPct: Math.min(100, Math.max(0, e.tamamlanmaYuzdesi)),
      durum: e.durum,
    };
  });
  return { bars, rangeStart: new Date(min).toISOString().slice(0, 10), rangeEnd: new Date(max).toISOString().slice(0, 10), skipped };
}

export function GanttChart({ entries }: { entries: WorkflowStatusEntry[] }) {
  const { bars, rangeStart, rangeEnd, skipped } = computeGanttBars(entries);
  if (bars.length === 0) {
    return <p className="text-xs text-gray-500">Tarihi belirlenmiş atama olmadığından Gantt çizilemedi.{skipped > 0 && ` (${skipped} kayıt tarihsiz)`}</p>;
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2" aria-label="Gantt grafiği">
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{rangeStart}</span>
        <span>{rangeEnd}</span>
      </div>
      <ul className="space-y-1.5">
        {bars.map((b, i) => (
          <li key={i} className="grid grid-cols-[12rem_1fr] items-center gap-3">
            <span className="truncate text-xs text-gray-700" title={b.label}>
              {b.label}
            </span>
            <div className="relative h-4 rounded bg-gray-50">
              <div
                className={`absolute top-0 h-4 rounded overflow-hidden ${b.durum === 'tamamlandi' ? 'bg-green-200' : 'bg-amber-200'}`}
                style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
                data-testid="gantt-bar"
              >
                <div className={`h-full ${b.durum === 'tamamlandi' ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${b.progressPct}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {skipped > 0 && <p className="text-[11px] text-gray-400">{skipped} kayıt tarihi olmadığı için grafikte yok (tabloda görünür).</p>}
    </div>
  );
}
