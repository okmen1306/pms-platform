import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMasterWorkPackages, fetchProjectWorkPackages, planWorkPackage } from '../project.api';
import { SubWorkPackages } from './SubWorkPackages';

/**
 * Madde 7 (docs/roadmap.md): "Ekip lideri iş planı yaparken her projede tüm iş paketlerini
 * seçmek zorunda olmamalı." Bu ekran, 10 master iş paketini checkbox listesi gibi gösterir;
 * seçilen/tarihi girilenler `project_work_packages`'ta satır olarak belirir, girilmeyenler
 * "yok" sayılır (backend zaten Day 5'te bu mantığı uyguluyor, burada sadece UI'ı var).
 */
export function WorkPackagesTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [selectedMaster, setSelectedMaster] = useState<number | null>(null);
  const [expandedWp, setExpandedWp] = useState<string | null>(null);
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');

  const { data: masterList = [] } = useQuery({
    queryKey: ['master-work-packages'],
    queryFn: fetchMasterWorkPackages,
  });

  const { data: projectPackages = [], isLoading } = useQuery({
    queryKey: ['work-packages', projectId],
    queryFn: () => fetchProjectWorkPackages(projectId),
  });

  const mutation = useMutation({
    mutationFn: () => planWorkPackage(projectId, selectedMaster!, baslangic || undefined, bitis || undefined),
    onSuccess: () => {
      setSelectedMaster(null);
      setBaslangic('');
      setBitis('');
      queryClient.invalidateQueries({ queryKey: ['work-packages', projectId] });
    },
  });

  const plannedMasterIds = new Set(projectPackages.map((p) => p.master_work_package_id));
  const plannedByMaster = new Map(projectPackages.map((p) => [p.master_work_package_id, p.id]));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {masterList.map((mwp) => {
          const isPlanned = plannedMasterIds.has(mwp.id);
          const indent = mwp.ust_id ? 'pl-8' : 'pl-3';
          return (
            <div key={mwp.id} className={`flex items-center justify-between py-2 pr-3 ${indent}`}>
              <span className="text-sm text-gray-800">
                {mwp.sira_no} {mwp.ad}
              </span>
              {isPlanned ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5">Planlandı</span>
                  <button
                    onClick={() => setExpandedWp(expandedWp === plannedByMaster.get(mwp.id) ? null : plannedByMaster.get(mwp.id) ?? null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Alt iş paketleri
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedMaster(mwp.id)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Planla
                </button>
              )}
            </div>
          );
        })}
      </div>

      {expandedWp && <SubWorkPackages workPackageId={expandedWp} />}

      {selectedMaster !== null && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">
            İş paketi planlanıyor — tarih girilmezse bu iş paketi proje için "yok" sayılır.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Başlangıç (opsiyonel)</label>
              <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Bitiş (opsiyonel)</label>
              <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Kaydet
            </button>
            <button onClick={() => setSelectedMaster(null)} className="text-xs text-gray-500">
              Vazgeç
            </button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600">
              {mutation.error instanceof Error ? mutation.error.message : 'Kaydedilemedi'}
            </p>
          )}
        </div>
      )}

      {isLoading && <p className="text-xs text-gray-500">İş paketleri yükleniyor...</p>}
    </div>
  );
}
