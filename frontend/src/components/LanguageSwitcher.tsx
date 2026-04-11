import React from 'react';
import { Languages } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
];

function setGoogleTranslateCookie(langCode: string) {
  if (langCode === 'en') {
    // Remove the translation cookie to revert to original
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

function getCurrentLang(): string {
  const match = document.cookie.match(/googtrans=\/en\/([a-z]+)/);
  return match ? match[1] : 'en';
}

export const LanguageSwitcher: React.FC = () => {
  const [current, setCurrent] = React.useState(getCurrentLang);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Re-trigger Google Translate after React renders dynamic content
  React.useEffect(() => {
    if (current === 'en') return;
    const timer = setTimeout(() => {
      try {
        const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
        if (select) {
          select.value = current;
          select.dispatchEvent(new Event('change'));
        }
      } catch { /* silent */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [current]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLang = LANGUAGES.find(l => l.code === current) || LANGUAGES[0];

  const select = (code: string) => {
    setCurrent(code);
    setOpen(false);
    setGoogleTranslateCookie(code);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
        title="Select language"
      >
        <Languages className="h-4 w-4 text-gray-500" />
        <span>{currentLang.flag}</span>
        <span className="hidden sm:inline text-gray-700 font-medium">{currentLang.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-gray-200 z-[9999] min-w-[140px] overflow-hidden">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => select(lang.code)}
              className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                current === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
              {current === lang.code && <span className="ml-auto text-blue-500">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
