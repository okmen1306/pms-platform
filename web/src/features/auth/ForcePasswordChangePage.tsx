import { useState, type FormEvent } from 'react';
import { validatePasswordPolicy } from '@pms/shared';
import { useAuth } from '../../app/AuthContext';
import { changeOwnPassword } from './auth.api';

/**
 * Day 22 (G-02): geçici parolayla giriş yapan kullanıcıya TÜM uygulama yerine gösterilir
 * (bkz. RequireAuth). Gateway de aynı kuralı sunucuda zorlar (PASSWORD_CHANGE_REQUIRED) — bu ekran
 * yalnızca kullanıcıyı doğru yere yönlendirir. Başarıdan sonra mevcut token hâlâ bayrak taşıdığından
 * kullanıcı çıkış yapıp YENİ parolayla yeniden giriş yapar.
 */
export function ForcePasswordChangePage() {
  const { user, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problems = validatePasswordPolicy(next);
    if (next !== confirm) problems.push('Yeni parola ve tekrarı aynı olmalı.');
    if (next === current) problems.push('Yeni parola geçici parolayla aynı olamaz.');
    setErrors(problems);
    if (problems.length > 0) return;
    setBusy(true);
    try {
      await changeOwnPassword(current, next);
      setDone(true);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Parola değiştirilemedi']);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-sm w-full space-y-3" role="status">
          <h1 className="text-lg font-semibold text-gray-900">Parolanız değiştirildi</h1>
          <p className="text-sm text-gray-600">Devam etmek için yeni parolanızla yeniden giriş yapın.</p>
          <button onClick={() => void logout()} className="w-full rounded-md bg-gray-900 text-white text-sm py-2">
            Girişe dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={submit} className="bg-white rounded-lg border border-gray-200 p-6 max-w-sm w-full space-y-3">
        <h1 className="text-lg font-semibold text-gray-900">Parolanızı belirleyin</h1>
        <p className="text-xs text-gray-500">
          {user?.email} hesabı geçici parolayla açıldı. Devam etmeden önce kendi parolanızı belirlemelisiniz.
        </p>
        <label className="block text-xs text-gray-600">
          Geçici parola
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="block text-xs text-gray-600">
          Yeni parola
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="block text-xs text-gray-600">
          Yeni parola (tekrar)
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        </label>
        {errors.length > 0 && (
          <ul className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 list-disc pl-5" role="alert">
            {errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        <button type="submit" disabled={busy || !current || !next} className="w-full rounded-md bg-gray-900 text-white text-sm py-2 disabled:opacity-50">
          {busy ? 'Kaydediliyor...' : 'Parolayı değiştir'}
        </button>
        <button type="button" onClick={() => void logout()} className="w-full text-xs text-gray-500 hover:underline">
          Çıkış
        </button>
      </form>
    </div>
  );
}
