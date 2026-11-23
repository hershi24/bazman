import { useEffect, useState, type FormEvent } from 'react';
import { Clock, LogIn, Loader2, Fingerprint, MapPin, QrCode, Mail, ArrowRight, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { emailAccountPassword } from '@/lib/updateAuth';
import { useLang } from '@/lib/LanguageProvider';
import LanguageToggle from '@/components/LanguageToggle';
import { localizeError, type MsgKey } from '@/lib/i18n';

export default function Login() {
  const { signIn } = useAuth();
  const { t, lang, isRtl } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKey, setErrorKey] = useState<MsgKey | null>(null);
  const [infoKey, setInfoKey] = useState<MsgKey | null>(null);
  const [busy, setBusy] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const type = hash.get('type') || query.get('type');
    const errCode = hash.get('error_code') || query.get('error_code');
    if (type === 'recovery') {
      return;
    }
    if (type === 'email_change') {
      setInfoKey('emailConfirmed');
    } else if (errCode === 'otp_expired' || hash.get('error') === 'access_denied') {
      setErrorKey('linkExpired');
    }
    if (type || errCode || hash.get('error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    setInfoKey(null);
    setBusy(true);
    const { error } = await signIn(email.trim(), password.trim());
    setBusy(false);
    if (error) setErrorKey('wrongDetails');
  }

  async function sendReset(e: FormEvent) {
    e.preventDefault();
    setResetMsg(null);
    const addr = resetEmail.trim().toLowerCase();
    if (!addr || !addr.includes('@')) {
      setResetMsg({ type: 'err', text: t('needEmail') });
      return;
    }
    setResetBusy(true);
    try {
      const { error } = await emailAccountPassword(addr, window.location.origin);
      if (error) {
        setResetMsg({ type: 'err', text: localizeError(error, t, lang) });
        return;
      }
      setResetMsg({
        type: 'ok',
        text: t('resetSent'),
      });
    } catch {
      setResetMsg({ type: 'err', text: t('resetFailed') });
    } finally {
      setResetBusy(false);
    }
  }

  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src="/login-bg.jpg"
          alt=""
          className="h-full w-full object-cover object-[18%_center]"
        />
        <div className="absolute inset-0 bg-slate-950/50" />
      </div>

      <div className="absolute top-4 end-4 z-20">
        <LanguageToggle variant="onDark" />
      </div>

      {/* Brand panel */}
      <div className="relative z-10 flex flex-1 flex-col justify-between overflow-hidden p-8 text-white lg:p-14">
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Clock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">BeZman</h1>
            <p className="text-sm text-brand-100">{t('loginTagline')}</p>
          </div>
        </div>

        <div className="relative my-10 max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight lg:text-4xl">
            {t('loginHeadline')}
            <span className="text-accent-300">{t('loginHeadlineAccent')}</span>
          </h2>
          <p className="mt-4 text-brand-100">
            {t('loginSub')}
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: MapPin, label: t('featGps') },
              { icon: QrCode, label: t('featQr') },
              { icon: Fingerprint, label: t('featAccuracy') },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <f.icon className="mx-auto h-6 w-6 text-accent-300" />
                <p className="mt-2 text-xs font-medium text-brand-100">{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative space-y-1 text-xs text-brand-200">
          <p>{t('copyright')}</p>
          <p>
            {t('developedBy')} <span className="font-semibold text-brand-100">{t('developedByName')}</span>
          </p>
        </div>
      </div>

      {/* Login form */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-md animate-fade-in-up rounded-3xl bg-white p-8 shadow-2xl">
          {!showReset ? (
            <>
              <h2 className="text-2xl font-extrabold text-slate-800">{t('loginTitle')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('loginSubtitle')}</p>

              <form onSubmit={submit} noValidate className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('email')}</label>
                  <input
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    dir="ltr"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.co.il"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-left text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('password')}</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                {infoKey && (
                  <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 animate-fade-in">{t(infoKey)}</div>
                )}
                {errorKey && (
                  <div className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 animate-fade-in">{t(errorKey)}</div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-bold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                  {busy ? t('signingIn') : t('signIn')}
                </button>
              </form>

              <button
                onClick={() => {
                  setShowReset(true);
                  setResetEmail(email);
                  setResetMsg(null);
                }}
                className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700"
              >
                <Mail className="h-4 w-4" />
                {t('forgotPassword')}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold text-slate-800">{t('resetTitle')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('resetSubtitle')}</p>

              <form onSubmit={sendReset} noValidate className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('email')}</label>
                  <input
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    dir="ltr"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@company.co.il"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-left text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                {resetMsg && (
                  <div
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
                      resetMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {resetMsg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {resetMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-bold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {resetBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                  {resetBusy ? t('sendingLink') : t('sendResetLink')}
                </button>
              </form>

              <button
                onClick={() => {
                  setShowReset(false);
                  setResetMsg(null);
                }}
                className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                <BackArrow className="h-4 w-4" />
                {t('backToLogin')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
