/** Load Google Translate only on demand — keeps PWA startup working on Wi‑Fi without internet. */

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        TranslateElement: new (
          options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
          elementId: string
        ) => void;
      };
    };
  }
}

let loadPromise: Promise<boolean> | null = null;

export function getTranslateLangFromCookie(): string {
  const match = document.cookie.match(/googtrans=\/en\/([a-z]+)/);
  return match ? match[1] : 'en';
}

/** Returns true when the widget initialized; false if offline or Google unreachable. */
export function loadGoogleTranslate(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!navigator.onLine) return Promise.resolve(false);
  if (document.querySelector('.goog-te-combo')) return Promise.resolve(true);

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const finish = (ok: boolean) => {
      if (!ok) loadPromise = null;
      resolve(ok);
    };

    const timeout = window.setTimeout(() => finish(false), 12000);

    window.googleTranslateElementInit = () => {
      window.clearTimeout(timeout);
      try {
        if (!document.getElementById('google_translate_element')) {
          const el = document.createElement('div');
          el.id = 'google_translate_element';
          el.style.display = 'none';
          document.body.appendChild(el);
        }
        new window.google!.translate.TranslateElement(
          { pageLanguage: 'en', includedLanguages: 'en,ta', autoDisplay: false },
          'google_translate_element'
        );
        finish(true);
      } catch {
        finish(false);
      }
    };

    const existing = document.querySelector('script[data-google-translate]');
    if (existing) {
      window.clearTimeout(timeout);
      finish(!!document.querySelector('.goog-te-combo'));
      return;
    }

    const script = document.createElement('script');
    script.dataset.googleTranslate = 'true';
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      finish(false);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function applyGoogleTranslateLang(langCode: string): void {
  try {
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (select && langCode !== 'en') {
      select.value = langCode;
      select.dispatchEvent(new Event('change'));
    }
  } catch {
    /* ignore */
  }
}
