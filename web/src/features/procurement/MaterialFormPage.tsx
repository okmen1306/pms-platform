import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { createMaterial, type CreateMaterialInput } from './procurement.api';

interface MaterialFormPageProps {
  projectId: string;
  onCreated: () => void;
}

/**
 * Madde 5 (docs/roadmap.md): dolar kuru OTOMATİK getirilir — bu form kur alanı İÇERMEZ,
 * backend (procurement-service) alım tarihine göre integration-service'ten otomatik çeker.
 * Manuel kur override'ı ayrı bir aksiyon olarak (Day 6+, MaterialListPage'de "kuru düzenle"
 * butonu ile) eklenecek — form karmaşıklaşmasın diye bugün dahil edilmedi.
 */
export function MaterialFormPage({ projectId, onCreated }: MaterialFormPageProps) {
  const { register, handleSubmit, reset } = useForm<Omit<CreateMaterialInput, 'projectId'>>();

  const mutation = useMutation({
    mutationFn: (values: Omit<CreateMaterialInput, 'projectId'>) =>
      createMaterial({ ...values, projectId, adet: Number(values.adet), birimFiyat: Number(values.birimFiyat) }),
    onSuccess: () => {
      reset();
      onCreated();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="grid grid-cols-2 gap-3 bg-white border border-gray-200 rounded-lg p-4"
    >
      <input
        {...register('malzemeTuru', { required: true })}
        placeholder="Malzeme Türü"
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
      <input
        {...register('malzemeAdi', { required: true })}
        placeholder="Malzeme Adı"
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
      <input
        {...register('teknikOzellik')}
        placeholder="Teknik Özellik (opsiyonel)"
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm col-span-2"
      />
      <input
        {...register('adet', { required: true })}
        type="number"
        step="0.01"
        placeholder="Adet"
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
      <input
        {...register('birimFiyat', { required: true })}
        type="number"
        step="0.01"
        placeholder="Birim Fiyat (TL)"
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
      <input
        {...register('alimTarihi', { required: true })}
        type="date"
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm col-span-2"
      />

      {mutation.isError && (
        <p className="col-span-2 text-xs text-red-600">
          {mutation.error instanceof Error ? mutation.error.message : 'Kayıt başarısız'}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="col-span-2 rounded-md bg-gray-900 text-white text-sm py-2 disabled:opacity-50"
      >
        {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </form>
  );
}
