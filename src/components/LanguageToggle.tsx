import { useLang } from '@/lib/LanguageProvider';

export default function LanguageToggle({
  variant = 'light',
}: {
  variant?: 'light' | 'onDark';
}) {
  const { lang, setLang, t } = useLang();
  const onDark = variant === 'onDark';

  return (
    <div
      className={`inline-flex items-center rounded-xl p-0.5 text-xs font-bold ${
        onDark ? 'bg-white/15 text-white' : 'border border-slate-200 bg-slate-50 text-slate-500'
      }`}
      role="group"
      aria-label={t('language')}
    >
      <button
        type="button"
        onClick={() => setLang('he')}
        className={`rounded-lg px-2.5 py-1.5 transition ${
          lang === 'he'
            ? onDark
              ? 'bg-white text-slate-800 shadow'
              : 'bg-white text-slate-800 shadow-sm'
            : onDark
              ? 'text-white/80 hover:text-white'
              : 'hover:text-slate-700'
        }`}
      >
        עברית
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`rounded-lg px-2.5 py-1.5 transition ${
          lang === 'en'
            ? onDark
              ? 'bg-white text-slate-800 shadow'
              : 'bg-white text-slate-800 shadow-sm'
            : onDark
              ? 'text-white/80 hover:text-white'
              : 'hover:text-slate-700'
        }`}
      >
        English
      </button>
    </div>
  );
}
