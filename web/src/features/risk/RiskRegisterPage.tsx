import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRisks, createRisk, updateRiskStatus, updateRisk, deleteRisk, type Risk } from './risk.api';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * F2 (Day 10): "RiskRegisterPage" — docs/roadmap.md Bölüm 14.3 satır 10. risk-service'in backend'i
 * (CRUD + `oncelik_puani` = olasılık × etki) Day 1-3'te ZATEN tamamen hazırdı; bugün sadece
 * frontend'i eklendi. Kalıcı bir navigasyon kabuğu/proje seçici henüz yok (Day 18+, bkz.
 * CostAnalysisPage.tsx'teki AYNI not) — proje ID'si elle girilir.
 *
 * F2 (Day 11): "RiskRegisterPage tamamlama". Backend'in her zaman desteklediği `aciklama`
 * (açıklama) + `azaltma_stratejisi` (azaltma stratejisi) alanları ne oluşturma formunda ne de
 * listede vardı — ikisi de eklendi, artı satır içi TAM alan düzenleme (risk_adi/olasılık/etki/
 * açıklama/azaltma stratejisi) — Day 10'da SADECE `durum` (hızlı dropdown) düzenlenebiliyordu.
 * Düzenleme deseni WorkPackagesTab.tsx'in "Planla" satır içi formuyla AYNI (bu kod tabanında
 * hiçbir yerde modal kullanılmıyor).
 */
export function RiskRegisterPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [riskAdi, setRiskAdi] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [olasilik, setOlasilik] = useState(3);
  const [etki, setEtki] = useState(3);
  const [azaltmaStratejisi, setAzaltmaStratejisi] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRiskAdi, setEditRiskAdi] = useState('');
  const [editAciklama, setEditAciklama] = useState('');
  const [editOlasilik, setEditOlasilik] = useState(3);
  const [editEtki, setEditEtki] = useState(3);
  const [editAzaltmaStratejisi, setEditAzaltmaStratejisi] = useState('');

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ['risks', projectId],
    queryFn: () => fetchRisks(projectId),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: () => createRisk(projectId, riskAdi, olasilik, etki, aciklama || undefined, azaltmaStratejisi || undefined),
    onSuccess: () => {
      setRiskAdi('');
      setAciklama('');
      setAzaltmaStratejisi('');
      queryClient.invalidateQueries({ queryKey: ['risks', projectId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ riskId, durum }: { riskId: string; durum: Risk['durum'] }) => updateRiskStatus(riskId, durum),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risks', projectId] }),
  });

  const editMutation = useMutation({
    mutationFn: (riskId: string) =>
      updateRisk(riskId, {
        riskAdi: editRiskAdi,
        aciklama: editAciklama,
        olasilik: editOlasilik,
        etki: editEtki,
        azaltmaStratejisi: editAzaltmaStratejisi,
      }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['risks', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (riskId: string) => deleteRisk(riskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risks', projectId] }),
  });

  function startEdit(r: Risk) {
    setEditingId(r.id);
    setEditRiskAdi(r.risk_adi);
    setEditAciklama(r.aciklama ?? '');
    setEditOlasilik(r.olasilik);
    setEditEtki(r.etki);
    setEditAzaltmaStratejisi(r.azaltma_stratejisi ?? '');
  }

  const durumLabel: Record<Risk['durum'], string> = { acik: 'Açık', izleniyor: 'İzleniyor', kapandi: 'Kapandı' };
  const durumClass: Record<Risk['durum'], string> = {
    acik: 'bg-red-50 text-red-700',
    izleniyor: 'bg-amber-50 text-amber-700',
    kapandi: 'bg-green-50 text-green-700',
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Risk Kayıt Defteri</h1>

      <input
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="Proje ID"
        className="w-full max-w-md rounded-md border border-gray-300 px-3 py-1.5 text-sm"
      />

      {projectId && (
        <>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 max-w-xl">
            <p className="text-sm font-medium text-gray-900">Yeni risk</p>
            <input
              value={riskAdi}
              onChange={(e) => setRiskAdi(e.target.value)}
              placeholder="Risk adı"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Açıklama (opsiyonel)"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Olasılık (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={olasilik}
                  onChange={(e) => setOlasilik(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Etki (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={etki}
                  onChange={(e) => setEtki(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <input
              value={azaltmaStratejisi}
              onChange={(e) => setAzaltmaStratejisi(e.target.value)}
              placeholder="Azaltma stratejisi (opsiyonel)"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => createMutation.mutate()}
              disabled={!riskAdi || createMutation.isPending}
              className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Ekle
            </button>
            {createMutation.isError && (
              <p className="text-xs text-red-600">
                {createMutation.error instanceof Error ? createMutation.error.message : 'Risk kaydedilemedi'}
              </p>
            )}
          </div>

          {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}

          {!isLoading && risks.length === 0 && (
            <EmptyState title="Henüz risk kaydedilmemiş" description="Bu proje için tanımlı bir risk yok." />
          )}

          {risks.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {/* Kural: risk-service zaten öncelik puanına (olasılık × etki) göre azalan sırada döner. */}
              {risks.map((r) =>
                editingId === r.id ? (
                  <div key={r.id} className="p-4 space-y-3 bg-gray-50">
                    <input
                      value={editRiskAdi}
                      onChange={(e) => setEditRiskAdi(e.target.value)}
                      placeholder="Risk adı"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={editAciklama}
                      onChange={(e) => setEditAciklama(e.target.value)}
                      placeholder="Açıklama (opsiyonel)"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Olasılık (1-5)</label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={editOlasilik}
                          onChange={(e) => setEditOlasilik(Number(e.target.value))}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Etki (1-5)</label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={editEtki}
                          onChange={(e) => setEditEtki(Number(e.target.value))}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <input
                      value={editAzaltmaStratejisi}
                      onChange={(e) => setEditAzaltmaStratejisi(e.target.value)}
                      placeholder="Azaltma stratejisi (opsiyonel)"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => editMutation.mutate(r.id)}
                        disabled={!editRiskAdi || editMutation.isPending}
                        className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        Kaydet
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-500">
                        Vazgeç
                      </button>
                    </div>
                    {editMutation.isError && (
                      <p className="text-xs text-red-600">
                        {editMutation.error instanceof Error ? editMutation.error.message : 'Risk güncellenemedi'}
                      </p>
                    )}
                  </div>
                ) : (
                  <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">{r.risk_adi}</p>
                      {r.aciklama && <p className="text-xs text-gray-600 mt-0.5">{r.aciklama}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Olasılık {r.olasilik} × Etki {r.etki} = Öncelik {r.oncelik_puani}
                      </p>
                      {r.azaltma_stratejisi && (
                        <p className="text-xs text-gray-500 mt-0.5">Azaltma: {r.azaltma_stratejisi}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={r.durum}
                        onChange={(e) => statusMutation.mutate({ riskId: r.id, durum: e.target.value as Risk['durum'] })}
                        className={`text-xs rounded-full px-2 py-0.5 border-0 ${durumClass[r.durum]}`}
                      >
                        <option value="acik">{durumLabel.acik}</option>
                        <option value="izleniyor">{durumLabel.izleniyor}</option>
                        <option value="kapandi">{durumLabel.kapandi}</option>
                      </select>
                      <button onClick={() => startEdit(r)} className="text-xs text-blue-600 hover:underline">
                        Düzenle
                      </button>
                      <button onClick={() => deleteMutation.mutate(r.id)} className="text-xs text-gray-400 hover:text-red-600">
                        Sil
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
