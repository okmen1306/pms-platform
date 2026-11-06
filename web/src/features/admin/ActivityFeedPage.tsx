import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_KEYS } from '@pms/shared';
import { RoleGuard } from '../../shared/components/RoleGuard';
import { EmptyState } from '../../shared/components/EmptyState';
import { actorLabel, fetchAuditDetail, type ActivityItem, type Severity } from './activity.api';
import { useActivityStream, type StreamStatus } from './useActivityStream';
import { SystemPulseDashboard } from './SystemPulseDashboard';

const SEVERITY_STYLE: Record<Severity, string> = {
  info: 'bg-gray-100 text-gray-600',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-700',
};
const SEVERITY_LABEL: Record<Severity, string> = { info: 'Bilgi', warning: 'Uyarı', critical: 'Kritik' };
const STATUS_LABEL: Record<StreamStatus, string> = { connecting: 'Bağlanıyor…', live: 'Canlı', reconnecting: 'Yeniden bağlanıyor…' };

const SENSITIVE_KEY = /password|parola|hash|token|secret|salt/i;

/** Ham JSON YERİNE alan-alan değişiklik listesi; hassas anahtarlar maskelenir, iç içe nesne özetlenir. */
export function describeChanges(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const show = (key: string, v: unknown): string => {
    if (SENSITIVE_KEY.test(key)) return '••••';
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'object') return '(ayrıntılı nesne)';
    return String(v);
  };
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return keys
    .filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))
    .map((k) => ({ field: k, before: show(k, before?.[k]), after: show(k, after?.[k]) }));
}

function DetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['audit-detail', id], queryFn: () => fetchAuditDetail(id) });
  const changes = data ? describeChanges(data.oncekiDeger, data.yeniDeger) : [];
  return (
    <div className="px-4 py-3 bg-gray-50 space-y-2" data-testid="activity-detail">
      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
      {isError && <p className="text-xs text-red-600">{error instanceof Error ? error.message : 'Denetim kaydı alınamadı'}</p>}
      {data && (
        <>
          <p className="text-xs text-gray-600">
            {data.service} · {data.eventType} · {new Date(data.createdAt).toLocaleString('tr-TR')} · {actorLabel(data)}
          </p>
          {data.entityType && (
            <p className="text-xs text-gray-500">
              Kayıt: {data.entityType}
              {data.entityId ? ` (${data.entityId})` : ''}
            </p>
          )}
          {changes.length === 0 ? (
            <p className="text-xs text-gray-500">Alan bazında değişiklik kaydı yok.</p>
          ) : (
            <table className="text-xs">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pr-4 font-medium">Alan</th>
                  <th className="pr-4 font-medium">Önce</th>
                  <th className="font-medium">Sonra</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.field}>
                    <td className="pr-4 text-gray-800">{c.field}</td>
                    <td className="pr-4 text-gray-500">{c.before}</td>
                    <td className="text-gray-800">{c.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      <button onClick={onClose} className="text-xs text-gray-500">
        Kapat
      </button>
    </div>
  );
}

function Row({ item, open, onToggle }: { item: ActivityItem; open: boolean; onToggle: () => void }) {
  return (
    <li>
      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm text-gray-800">{item.ozet}</p>
          <p className="text-xs text-gray-500">
            {actorLabel(item)} · {item.service} · {new Date(item.createdAt).toLocaleTimeString('tr-TR')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs rounded-full px-2 py-0.5 ${SEVERITY_STYLE[item.severity]}`}>{SEVERITY_LABEL[item.severity]}</span>
          <button onClick={onToggle} className="text-xs text-gray-500 hover:text-gray-900 underline">
            Detay Gör
          </button>
        </div>
      </div>
      {open && <DetailPanel id={item.id} onClose={onToggle} />}
    </li>
  );
}

/** Day 22 (madde 4): canlı aktivite akışı + sistem nabzı. Yetki: `admin.audit_log` (gateway `/logger/*` ile aynı). */
export function ActivityFeedPage() {
  const { items, status } = useActivityStream();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <RoleGuard
      permissionKey={PERMISSION_KEYS.ADMIN_AUDIT_LOG}
      fallback={
        <div className="p-6">
          <EmptyState title="Bu sayfayı görüntüleme yetkiniz yok" description="Aktivite akışı yalnızca yetkili yöneticilere açıktır." />
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Aktivite Akışı</h1>
          <span
            role="status"
            className={`text-xs rounded-full px-2 py-0.5 ${status === 'live' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <SystemPulseDashboard />
        {items.length === 0 ? (
          <EmptyState title="Henüz etkinlik yok" description="Bir işlem yapıldığında burada anında görünür." />
        ) : (
          <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {items.map((i) => (
              <Row key={i.id} item={i} open={openId === i.id} onToggle={() => setOpenId(openId === i.id ? null : i.id)} />
            ))}
          </ul>
        )}
      </div>
    </RoleGuard>
  );
}
