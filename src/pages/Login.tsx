import { useEffect, useState, type FormEvent } from 'react';
import { Clock, LogIn, Loader2, Fingerprint, MapPin, QrCode, Mail, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { emailAccountPassword } from '@/lib/updateAuth';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
    if (type === 'email_change') {
      setInfo('האימייל אושר. אפשר להתחבר עם הכתובת החדשה.');
    } else if (errCode === 'otp_expired' || hash.get('error') === 'access_denied') {
      setError('קישור האישור אינו תקף. האימייל מתעדכן ישירות בהגדרות, בלי קישור.');
    }
    if (type || errCode || hash.get('error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn(email.trim(), password.trim());
    setBusy(false);
    if (error) setError('הפרטים שגויים. נסה שוב.');
  }

  async function sendReset(e: FormEvent) {
    e.preventDefault();
    setResetMsg(null);
    if (!resetEmail.trim()) {
      setResetMsg({ type: 'err', text: 'נא להזין כתובת אימייל.' });
      return;
    }
    setResetBusy(true);
    const { error } = await emailAccountPassword(resetEmail.trim());
    setResetBusy(false);
    if (error) {
      setResetMsg({ type: 'err', text: error });
    } else {
      setResetMsg({ type: 'ok', text: 'סיסמה חדשה נשלחה לאימייל שלך. בדוק את תיבת הדואר והתחבר איתה.' });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-bl from-brand-950 via-brand-800 to-brand-600 lg:flex-row">
      {/* Brand panel */}
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden p-8 text-white lg:p-14">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-accent-400 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-brand-300 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Clock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">BeZman</h1>
            <p className="text-sm text-brand-100">פתרונות נוכחות לעסקים</p>
          </div>
        </div>

        <div className="relative my-10 max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight lg:text-4xl">
            נהלו נוכחות, משמרות ודיווחים — <span className="text-accent-300">בקלות ובדיוק</span>
          </h2>
          <p className="mt-4 text-brand-100">
            מערכת ארגונית למעקב נוכחות עם אימות GPS וסריקת QR, ניהול משמרות, בקשות עובדים ודוחות בזמן אמת.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: MapPin, label: 'אימות GPS' },
              { icon: QrCode, label: 'סריקת QR' },
              { icon: Fingerprint, label: 'דיוק מלא' },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <f.icon className="mx-auto h-6 w-6 text-accent-300" />
                <p className="mt-2 text-xs font-medium text-brand-100">{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative space-y-1 text-xs text-brand-200">
          <p>© 2026 BeZman — כל הזכויות שמורות</p>
          <p>
            פותח על ידי <span className="font-semibold text-brand-100">גליצקי פתרונות טכנולוגיים לעסקים</span>
          </p>
        </div>
      </div>

      {/* Login form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-md animate-fade-in-up rounded-3xl bg-white p-8 shadow-2xl">
          {!showReset ? (
            <>
              <h2 className="text-2xl font-extrabold text-slate-800">כניסה למערכת</h2>
              <p className="mt-1 text-sm text-slate-500">הזן את פרטי החיבור</p>

              <form onSubmit={submit} noValidate className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">אימייל</label>
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
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">סיסמה</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                {info && (
                  <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 animate-fade-in">{info}</div>
                )}
                {error && (
                  <div className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 animate-fade-in">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-bold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                  {busy ? 'מתחבר...' : 'כניסה'}
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
                שכחת סיסמה?
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold text-slate-800">איפוס סיסמה</h2>
              <p className="mt-1 text-sm text-slate-500">נשלח לאימייל שלך את הסיסמה החדשה של החשבון</p>

              <form onSubmit={sendReset} noValidate className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">אימייל</label>
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
                  {resetBusy ? 'שולח...' : 'שלח סיסמה לאימייל'}
                </button>
              </form>

              <button
                onClick={() => {
                  setShowReset(false);
                  setResetMsg(null);
                }}
                className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                <ArrowRight className="h-4 w-4" />
                חזרה לכניסה
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
