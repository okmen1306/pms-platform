import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { login } from './auth.api';
import { useAuth } from '../../app/AuthContext';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';

interface LoginFormValues {
  email: string;
  password: string;
}

/**
 * Day 18: `login()` artık gerçek api-gateway'e (`POST /identity/auth/login`) bağlı, oturum
 * AuthContext'te (bkz. AuthContext.tsx — access token bellekte, kalıcılık httpOnly refresh
 * cookie'siyle). Hata mesajı sunucunun döndürdüğü mesajdır (ör. "E-posta veya parola hatalı").
 */
export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, status, setUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>();

  // Day 18: sessiz refresh oturumu geri yüklediyse (geçerli refresh cookie'si) giriş formunu gösterme.
  useEffect(() => {
    if (status === 'ready' && user) navigate('/finance/cost-analysis', { replace: true });
  }, [status, user, navigate]);

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await login(values.email, values.password);
      setUser(result.user);
      navigate('/finance/cost-analysis');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Giriş yapılamadı');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-3">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="w-full bg-white rounded-lg shadow p-8 space-y-4"
        >
          <h1 className="text-xl font-semibold text-gray-900">{t('auth.loginTitle')}</h1>

          {errorMessage && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {errorMessage}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
            <input
              type="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              {...register('email', { required: true })}
            />
            {errors.email && <p className="text-xs text-red-600 mt-1">Gerekli alan</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
            <input
              type="password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              {...register('password', { required: true })}
            />
            {errors.password && <p className="text-xs text-red-600 mt-1">Gerekli alan</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gray-900 text-white text-sm font-medium py-2 disabled:opacity-50"
          >
            {submitting ? t('auth.loading') : t('auth.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
