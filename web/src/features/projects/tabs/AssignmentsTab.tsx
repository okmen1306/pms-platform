import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAssignments,
  fetchMasterWorkPackages,
  fetchProjectWorkPackages,
  checkAssignmentConflict,
  createAssignment,
  completeAssignment,
  type ConflictCheckResult,
} from '../project.api';
import { fetchEmployees } from '../../personnel/personnel.api';
import { EmptyState } from '../../../shared/components/EmptyState';
import { describeProjectError } from '../projectErrors';

/**
 * F1 (Day 8): "AssignmentsTab + çakışma uyarı UI" (docs/roadmap.md Bölüm 14.2 Day 8 satırı).
 * WeeklyAllocationTab (Day 7) EKİP bazında haftalık kapasite planlar; bu sekme ise TEK TEK
 * personeli belirli iş paketi + tarih aralığına ATAR (project_personnel_assignments, bkz.
 * assign-personnel.usecase.ts Day 7).
 *
 * Çakışma uyarısı: personel + tarih aralığı seçilir seçilmez (debounce'lu) B1'in bugün eklediği
 * `checkAssignmentConflict` çağrılır — VARSA sarı bir uyarı gösterilir ama GÖNDER butonu
 * DEVRE DIŞI BIRAKILMAZ (WeeklyAllocationTab'daki kapasite uyarısıyla AYNI felsefe: kesin karar
 * her zaman backend'de — burada da öyle, backend zaten 409 ile reddedecek). Bu bilinçli bir
 * seçim: ağ gecikmesi/eski veri yüzünden UI'ın YANLIŞLIKLA engellemesindense, kullanıcıyı
 * bilgilendirip son kararı backend'in kesin kontrolüne (DB'nin `EXCLUDE USING gist`
 * kısıtlaması) bırakmak daha güvenli.
 */
export function AssignmentsTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [workPackageId, setWorkPackageId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [conflict, setConflict] = useState<ConflictCheckResult | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  const { data: workPackages = [] } = useQuery({
    queryKey: ['work-packages', projectId],
    queryFn: () => fetchProjectWorkPackages(projectId),
  });
  // Day 19: iş paketi seçiminde ham UUID yerine üst iş paketinin ADI gösterilir (gerçek API'de
  // `project_work_packages.id` bir UUID — mock dönemi bunu kullanıcıya gösterilebilir sanıyordu).
  const { data: masterList = [] } = useQuery({ queryKey: ['master-work-packages'], queryFn: fetchMasterWorkPackages });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => fetchEmployees('active') });
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments', projectId],
    queryFn: () => fetchAssignments(projectId),
  });

  // Personel + iki tarih de doluyken, kullanıcı yazmayı bıraktıktan 400ms sonra çakışma kontrolü
  // yap (her tuş vuruşunda backend'e gitmemek için basit bir debounce).
  useEffect(() => {
    if (!employeeId || !baslangic || !bitis) {
      setConflict(null);
      return;
    }
    setCheckingConflict(true);
    const timer = setTimeout(() => {
      checkAssignmentConflict(projectId, employeeId, baslangic, bitis)
        .then(setConflict)
        .catch(() => setConflict(null)) // sessiz başarısızlık: bu sadece bir UI ipucu, GÖNDER'i engellemiyor
        .finally(() => setCheckingConflict(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [projectId, employeeId, baslangic, bitis]);

  const mutation = useMutation({
    mutationFn: () => createAssignment(projectId, workPackageId, employeeId, baslangic, bitis),
    onSuccess: () => {
      setEmployeeId('');
      setBaslangic('');
      setBitis('');
      setConflict(null);
      queryClient.invalidateQueries({ queryKey: ['assignments', projectId] });
    },
  });

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const masterById = new Map(masterList.map((m) => [m.id, m]));
  const workPackageLabel = (id: string) => {
    const wp = workPackages.find((w) => w.id === id);
    const master = wp ? masterById.get(wp.master_work_package_id) : undefined;
    return master ? `${master.sira_no} ${master.ad}` : id;
  };
  const selectedEmployee = employeeById.get(employeeId);

  // Day 20: PATCH /assignments/:id/complete (CORS düzeltmesi Day 19'da yapıldı; UI'ı bugün).
  // Tamamlanınca backend `work_package.completed` yayınlar (rapor/performans/e-posta zinciri).
  const completeMutation = useMutation({
    mutationFn: (assignmentId: string) => completeAssignment(assignmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments', projectId] }),
  });

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-900">Yeni personel ataması</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">İş Paketi</label>
            <select
              value={workPackageId}
              onChange={(e) => setWorkPackageId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Seçiniz</option>
              {workPackages.map((wp) => (
                <option key={wp.id} value={wp.id}>{workPackageLabel(wp.id)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Personel</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Seçiniz</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.ad} {emp.soyad}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Başlangıç</label>
            <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Bitiş</label>
            <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
        </div>

        {checkingConflict && <p className="text-xs text-gray-400">Çakışma kontrol ediliyor...</p>}

        {conflict?.hasConflict && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 space-y-1">
            <p className="font-medium">
              ⚠ {employeeById.get(employeeId)?.ad ?? 'Bu personel'}, seçilen tarih aralığında zaten {conflict.conflictingAssignments.length} atamaya sahip:
            </p>
            <ul className="list-disc list-inside">
              {conflict.conflictingAssignments.map((a) => (
                <li key={a.id}>{a.baslangic_tarihi} → {a.bitis_tarihi}</li>
              ))}
            </ul>
            <p className="text-amber-600">Yine de kaydetmeyi deneyebilirsiniz — kesin kontrol backend'de yapılır.</p>
          </div>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={!workPackageId || !employeeId || !baslangic || !bitis || mutation.isPending}
          className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
        >
          Kaydet
        </button>
        {mutation.isError && (
          <p className="text-xs text-red-600">
            {describeProjectError(
              mutation.error,
              { employeeName: selectedEmployee ? `${selectedEmployee.ad} ${selectedEmployee.soyad}` : undefined },
              'Atama kaydedilemedi',
            )}
          </p>
        )}
      </div>

      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}

      {completeMutation.isError && (
        <p role="alert" className="text-xs text-red-600">{describeProjectError(completeMutation.error, {}, 'Atama tamamlanamadı')}</p>
      )}

      {!isLoading && assignments.length === 0 && (
        <EmptyState title="Henüz atama yok" description="Bu projede henüz kimse bir iş paketine atanmadı." />
      )}

      {assignments.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {assignments.map((a) => {
            const emp = employeeById.get(a.employee_id);
            return (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm text-gray-800">{emp ? `${emp.ad} ${emp.soyad}` : a.employee_id}</p>
                  <p className="text-xs text-gray-400">
                    {workPackageLabel(a.work_package_id)} · {a.baslangic_tarihi} → {a.bitis_tarihi}
                  </p>
                </div>
                {a.tamamlandi_mi ? (
                  <span className="text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5">Tamamlandı</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">Devam ediyor</span>
                    <button
                      onClick={() => completeMutation.mutate(a.id)}
                      disabled={completeMutation.isPending && completeMutation.variables === a.id}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      Tamamla
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
