import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PERMISSION_KEYS } from '@pms/shared';
import { createProject, fetchBusinessDays, fetchProductGroups, fetchProducts } from './project.api';
import { fetchEmployees } from '../personnel/personnel.api';
import { describeProjectError } from './projectErrors';
import { RoleGuard } from '../../shared/components/RoleGuard';
import { CurrencyBadge } from '../../shared/components/CurrencyBadge';

const STEPS = ['Temel bilgiler', 'Tarihler', 'Maliyet'] as const;
const inputClass = 'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm';

/** Boş string → undefined; aksi halde sayı (geçersizse NaN → undefined). */
function optionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Day 20 (G-07): "Proje Planlama" sihirbazı — Excel prototipindeki "sarı hücre" mantığı: kullanıcı
 * yalnızca başlangıç/bitiş tarihini girer, SÜRE ÖNİZLEMESİ resmî tatiller düşülerek (Kural #3,
 * integration-service) otomatik hesaplanır. Sunucu süreyi KENDİSİ yeniden hesaplar; buradaki
 * önizleme yalnızca kullanıcıya ne olacağını gösterir. Maliyet adımı (3) yalnızca
 * `finance.cost_analysis` düzenleme izni olanlara görünür (Bölüm 4.4: "SADECE YONETICI" alanları).
 */
export function ProjectPlanningWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    projeAdi: '', productGroupId: '', productId: '', ekipLideriId: '',
    baslangicTarihi: '', bitisTarihi: '',
    tahminiMaliyetTl: '', satisFiyatiTl: '', danismanlikMaliyetiTl: '', paketlemeGonderimMaliyetiTl: '', idariMaliyetYuzde: '',
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const { data: groups = [] } = useQuery({ queryKey: ['product-groups'], queryFn: fetchProductGroups });
  const { data: products = [] } = useQuery({
    queryKey: ['products', form.productGroupId],
    queryFn: () => fetchProducts(form.productGroupId),
    enabled: form.productGroupId !== '',
  });
  const { data: employees = [] } = useQuery({ queryKey: ['employees', 'active'], queryFn: () => fetchEmployees('active') });

  const datesValid = form.baslangicTarihi !== '' && form.bitisTarihi !== '' && form.bitisTarihi >= form.baslangicTarihi;
  const { data: businessDays, isFetching: previewLoading } = useQuery({
    queryKey: ['business-days', form.baslangicTarihi, form.bitisTarihi],
    queryFn: () => fetchBusinessDays(form.baslangicTarihi, form.bitisTarihi),
    enabled: datesValid,
  });
  const previewWeeks = businessDays ? Math.ceil(businessDays.totalBusinessDays / 5) : null;

  const mutation = useMutation({
    mutationFn: () =>
      createProject({
        projeAdi: form.projeAdi.trim(),
        baslangicTarihi: form.baslangicTarihi,
        bitisTarihi: form.bitisTarihi,
        productGroupId: form.productGroupId,
        productId: form.productId,
        ekipLideriId: form.ekipLideriId,
        tahminiMaliyetTl: optionalNumber(form.tahminiMaliyetTl),
        satisFiyatiTl: optionalNumber(form.satisFiyatiTl),
        danismanlikMaliyetiTl: optionalNumber(form.danismanlikMaliyetiTl),
        paketlemeGonderimMaliyetiTl: optionalNumber(form.paketlemeGonderimMaliyetiTl),
        idariMaliyetOrani: optionalNumber(form.idariMaliyetYuzde) !== undefined ? optionalNumber(form.idariMaliyetYuzde)! / 100 : undefined,
      }),
    onSuccess: (project) => navigate(`/projects/${project.id}`),
  });

  const stepValid = [
    form.projeAdi.trim().length >= 2 && form.productGroupId !== '' && form.productId !== '' && form.ekipLideriId !== '',
    datesValid,
    true,
  ];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Yeni Proje</h1>
        <Link to="/projects" className="text-xs text-gray-500 hover:underline">Vazgeç</Link>
      </div>

      <ol className="flex gap-2 text-xs" aria-label="Adımlar">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined} className={`rounded-full px-3 py-1 ${i === step ? 'bg-gray-900 text-white' : i < step ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <div>
            <label htmlFor="proje-adi" className="block text-xs text-gray-600 mb-1">Proje adı</label>
            <input id="proje-adi" value={form.projeAdi} onChange={(e) => set('projeAdi')(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="urun-grubu" className="block text-xs text-gray-600 mb-1">Ürün grubu</label>
              <select id="urun-grubu" value={form.productGroupId} onChange={(e) => { set('productGroupId')(e.target.value); set('productId')(''); }} className={inputClass}>
                <option value="">Seçin</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.ad}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="urun" className="block text-xs text-gray-600 mb-1">Ürün</label>
              <select id="urun" value={form.productId} onChange={(e) => set('productId')(e.target.value)} disabled={form.productGroupId === ''} className={inputClass}>
                <option value="">{form.productGroupId === '' ? 'Önce ürün grubu seçin' : 'Seçin'}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.ad}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="ekip-lideri" className="block text-xs text-gray-600 mb-1">Ekip lideri</label>
            <select id="ekip-lideri" value={form.ekipLideriId} onChange={(e) => set('ekipLideriId')(e.target.value)} className={inputClass}>
              <option value="">Seçin</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.ad} {e.soyad}</option>)}
            </select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="baslangic" className="block text-xs text-gray-600 mb-1">Başlangıç tarihi</label>
              <input id="baslangic" type="date" value={form.baslangicTarihi} onChange={(e) => set('baslangicTarihi')(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="bitis" className="block text-xs text-gray-600 mb-1">Bitiş tarihi</label>
              <input id="bitis" type="date" value={form.bitisTarihi} min={form.baslangicTarihi || undefined} onChange={(e) => set('bitisTarihi')(e.target.value)} className={inputClass} />
            </div>
          </div>
          {form.baslangicTarihi !== '' && form.bitisTarihi !== '' && !datesValid && (
            <p role="alert" className="text-xs text-red-600">Bitiş tarihi, başlangıç tarihinden önce olamaz.</p>
          )}
          {datesValid && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800" aria-live="polite">
              {previewLoading || !businessDays ? 'Süre hesaplanıyor…' : (
                <>Süre (otomatik): <strong>{businessDays.totalBusinessDays} iş günü ≈ {previewWeeks} hafta</strong> <span className="text-xs text-gray-500">— resmî tatiller düşülmüştür</span></>
              )}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <RoleGuard
          permissionKey={PERMISSION_KEYS.FINANCE_COST_ANALYSIS}
          need="edit"
          fallback={<p className="text-xs text-gray-500">Maliyet bilgileri yalnızca yetkili yöneticiler tarafından girilir. Projeyi bu alanlar olmadan oluşturabilirsiniz.</p>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['tahminiMaliyetTl', 'Tahmini maliyet (TL)'],
              ['satisFiyatiTl', 'Satış fiyatı (TL)'],
              ['danismanlikMaliyetiTl', 'Danışmanlık maliyeti (TL)'],
              ['paketlemeGonderimMaliyetiTl', 'Paketleme / gönderim (TL)'],
              ['idariMaliyetYuzde', 'İdari maliyet oranı (%)'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label htmlFor={key} className="block text-xs text-gray-600 mb-1">{label}</label>
                <input id={key} type="number" min="0" step="any" value={form[key]} onChange={(e) => set(key)(e.target.value)} className={inputClass} />
                {key !== 'idariMaliyetYuzde' && optionalNumber(form[key]) !== undefined && (
                  <p className="mt-1 text-xs text-gray-400"><CurrencyBadge amountTl={optionalNumber(form[key])!} estimateUsdWithCurrentRate /></p>
                )}
              </div>
            ))}
          </div>
        </RoleGuard>
      )}

      {mutation.isError && (
        <p role="alert" className="text-xs text-red-600">{describeProjectError(mutation.error, {}, 'Proje oluşturulamadı')}</p>
      )}

      <div className="flex justify-between">
        <button onClick={() => setStep((s) => s - 1)} disabled={step === 0 || mutation.isPending} className="text-xs text-gray-600 disabled:opacity-40">Geri</button>
        {isLast ? (
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !stepValid.every(Boolean)} className="rounded-md bg-gray-900 text-white text-xs px-4 py-1.5 disabled:opacity-50">
            {mutation.isPending ? 'Oluşturuluyor…' : 'Projeyi oluştur'}
          </button>
        ) : (
          <button onClick={() => setStep((s) => s + 1)} disabled={!stepValid[step]} className="rounded-md bg-gray-900 text-white text-xs px-4 py-1.5 disabled:opacity-50">İleri</button>
        )}
      </div>
    </div>
  );
}
