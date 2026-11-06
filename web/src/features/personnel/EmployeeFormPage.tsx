import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createEmployee } from './personnel.api';

interface EmployeeFormValues {
  ad: string;
  soyad: string;
  email: string;
  iseBaslamaTarihi: string;
  maasTl: number;
}

/**
 * Day 5: personnel-service'in Day 2'de hazır olan `POST /employees` endpoint'ine gerçek
 * bağlantı. Maaş alanı formda VAR (İK yöneticisi/yönetici girer), ama listede (EmployeeListPage)
 * izin yoksa hiç GÖSTERİLMEZ — girme yetkisi ile görme yetkisi farklı kavramlar (RBAC Day 6-8'de
 * bu formun kendisi de RoleGuard ile sarmalanacak, şimdilik herkese açık geliştirme modunda).
 */
export function EmployeeFormPage() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormValues>();

  const mutation = useMutation({
    mutationFn: (values: EmployeeFormValues) => createEmployee(values),
    onSuccess: () => {
      setSuccessMessage('Personel başarıyla eklendi.');
      reset();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const onSubmit = (values: EmployeeFormValues) => {
    setSuccessMessage(null);
    mutation.mutate({ ...values, maasTl: Number(values.maasTl) });
  };

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Yeni Personel</h1>

      {successMessage && (
        <p className="mb-4 text-xs text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2">
          {successMessage}
        </p>
      )}
      {mutation.isError && (
        <p className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {mutation.error instanceof Error ? mutation.error.message : 'Personel eklenemedi'}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad</label>
            <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" {...register('ad', { required: true })} />
            {errors.ad && <p className="text-xs text-red-600 mt-1">Gerekli alan</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Soyad</label>
            <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" {...register('soyad', { required: true })} />
            {errors.soyad && <p className="text-xs text-red-600 mt-1">Gerekli alan</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
          <input type="email" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" {...register('email', { required: true })} />
          {errors.email && <p className="text-xs text-red-600 mt-1">Geçerli bir e-posta girin</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İşe Başlama Tarihi</label>
            <input type="date" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" {...register('iseBaslamaTarihi', { required: true })} />
            {errors.iseBaslamaTarihi && <p className="text-xs text-red-600 mt-1">Gerekli alan</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maaş (TL)</label>
            <input type="number" step="0.01" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" {...register('maasTl', { required: true, min: 1 })} />
            {errors.maasTl && <p className="text-xs text-red-600 mt-1">0'dan büyük bir değer girin</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-gray-900 text-white text-sm font-medium py-2 disabled:opacity-50"
        >
          {mutation.isPending ? 'Kaydediliyor...' : 'Personeli Kaydet'}
        </button>
      </form>
    </div>
  );
}
