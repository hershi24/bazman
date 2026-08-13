import { useState, type FormEvent } from 'react';
import { Lock, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function ResetPassword() {
  const { exitRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-brand-950 via-brand-800 to-brand-600 p-6">
      <div className="w-full max-w-md animate-fade-in-up rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3 text-brand-700">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100">
            <Clock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">BeZman</h1>
            <p className="text-sm text-slate-500">איפוס סיסמה</p>
          </div>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <h2 className="text-xl font-bold text-slate-800">הסיסמה עודכנה בהצלחה!</h2>
            <p className="text-sm text-slate-500">כעת תוכל להתחבר למערכת עם הסיסמה החדשה.</p>
            <button
              onClick={exitRecovery}
              className="w-full rounded-xl bg-brand-600 px-4 py-3 font-bold text-white transition hover:bg-brand-700"
            >
              חזרה לכניסה
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-extrabold text-slate-800">בחירת סיסמה חדשה</h2>
            <p className="mt-1 text-sm text-slate-500">הזן את הסיסמה החדשה שלך לפחות 6 תווים</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">סיסמה חדשה</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">אימות סיסמה</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
                  <XCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-bold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
                {busy ? 'מעדכן...' : 'עדכן סיסמה'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
