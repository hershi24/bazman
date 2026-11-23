import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  applyDocumentLang,
  persistLang,
  readStoredLang,
  translate,
  type Lang,
  type MsgKey,
  type TranslateFn,
} from '@/lib/i18n';

type LanguageContextValue = {
  lang: Lang;
  isRtl: boolean;
  setLang: (lang: Lang) => void;
  bindUser: (userId: string) => void;
  t: TranslateFn;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({
  children,
  lockHebrew = false,
}: {
  children: ReactNode;
  lockHebrew?: boolean;
}) {
  const userIdRef = useRef<string | null>(null);
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    persistLang(next, userIdRef.current);
  }, []);

  const bindUser = useCallback((userId: string) => {
    userIdRef.current = userId;
    const stored = readStoredLang(userId);
    setLangState(stored);
    persistLang(stored, userId);
  }, []);

  const documentLang = lockHebrew ? 'he' : lang;

  useEffect(() => {
    applyDocumentLang(documentLang);
  }, [documentLang]);

  const t = useCallback<TranslateFn>((key: MsgKey, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(
    () => ({ lang, isRtl: lang === 'he', setLang, bindUser, t }),
    [lang, setLang, bindUser, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
