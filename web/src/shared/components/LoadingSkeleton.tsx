/** Day 21 (F1): yükleme iskeleti — izinler/oturum gelirken boş ekran yerine gösterilir. */
export function LoadingSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="p-6 space-y-3 animate-pulse" role="status" aria-label="Yükleniyor">
      <div className="h-5 w-1/3 rounded bg-gray-200" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-3 rounded bg-gray-100" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
