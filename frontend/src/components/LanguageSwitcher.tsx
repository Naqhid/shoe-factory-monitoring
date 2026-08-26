import React from 'react';
import { Languages } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  applyGoogleTranslateLang,
  getTranslateLangFromCookie,
  loadGoogleTranslate,
} from '../utils/googleTranslateLoader';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
];

function setGoogleTranslateCookie(langCode: string) {
  if (langCode === 'en') {
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
    window.location.reload();
    return;
  }
  const value = `/en/${langCode}`;
  document.cookie = `googtrans=${value}; path=/`;
  document.cookie = `googtrans=${value}; path=/; domain=${window.location.hostname}`;
  window.location.reload();
}

export const LanguageSwitcher: React.FC = () => {
  const [current, setCurrent] = React.useState(getTranslateLangFromCookie);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Apply Tamil only after widget loads — never fetch Google on English / offline startup
  React.useEffect(() => {
    if (current === 'en') return;
    let cancelled = false;
    let timer: number | undefined;
    loadGoogleTranslate().then((ok) => {
      if (cancelled || !ok) return;
      timer = window.setTimeout(() => applyGoogleTranslateLang(current), 800);
    });
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [current]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === current) || LANGUAGES[0];

  const select = async (code: string) => {
    setOpen(false);
    if (code === 'en') {
      setCurrent('en');
      setGoogleTranslateCookie('en');
      return;
    }
    if (!navigator.onLine) {
      toast.error('Tamil translation needs internet. App works in English on Wi‑Fi only.');
      return;
    }
    setCurrent(code);
    setGoogleTranslateCookie(code);
  };

  return (
    <div className="flex items-center gap-1" ref={ref}>
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-2.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors text-sm w-full touch-manipulation"
          title="Select language"
        >
          <Languages className="h-5 w-5 sm:h-4 sm:w-4 text-gray-600" />
          <span className="text-base sm:text-sm">{currentLang.flag}</span>
          <span className="text-gray-700 font-medium text-sm">{currentLang.label}</span>
        </button>

        {open && (
          <div className="absolute left-0 sm:right-0 sm:left-auto top-12 sm:top-10 bg-white rounded-xl shadow-xl border border-gray-200 z-[9999] min-w-[160px] overflow-hidden">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => select(lang.code)}
                className={`flex items-center gap-2.5 w-full px-4 py-3.5 sm:py-2.5 text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation ${
                  current === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.label}</span>
                {current === lang.code && <span className="ml-auto text-blue-500">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
