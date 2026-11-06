interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** docs/roadmap.md Bölüm 18: her liste için tutarlı boş-durum gösterimi (boş beyaz ekran olmaz). */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-gray-200 rounded-lg">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="text-xs text-gray-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
