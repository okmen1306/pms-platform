import { useTranslation } from 'react-i18next';

/**
 * Kural #2 (docs/roadmap.md): TR/EN dil seçeneği tüm ekranlarda zorunlu.
 * Day 2: basit toggle. Kalıcı tercih (kullanıcının identity_users.dil_tercihi alanına
 * yazılması) Day 18 entegrasyon haftasında gerçek API'ye bağlanınca eklenecek; şimdilik
 * sadece i18next dilini anlık değiştirir.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const setLang = (lang: 'tr' | 'en') => i18n.changeLanguage(lang);

  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs font-medium">
      <button
        type="button"
        onClick={() => setLang('tr')}
        className={`px-2.5 py-1 ${i18n.language === 'tr' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}
      >
        TR
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 ${i18n.language === 'en' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}
      >
        EN
      </button>
    </div>
  );
}
