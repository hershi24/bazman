import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  exitRecovery: () => void;
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function profileFromUser(user: User): Profile {
  const role = user.user_metadata?.role === 'manager' ? 'manager' : 'employee';
  return {
    id: user.id,
    role,
    full_name: String(user.user_metadata?.full_name ?? 'משתמש'),
    employee_number: null,
    department_id: null,
    phone: null,
    avatar_url: null,
    birth_date: null,
    hire_date: null,
    status: 'active',
    created_at: user.created_at ?? new Date().toISOString(),
    work_days: null,
    hours_quota_type: null,
    hours_quota: null,
    overtime_eligible: null,
    overtime_threshold: null,
    hidden: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  async function loadProfile(uid: string, user?: User | null) {
    const withDept = await supabase
      .from('profiles')
      .select('*, department:departments(*)')
      .eq('id', uid)
      .maybeSingle();

    if (withDept.data) {
      setProfile(withDept.data as Profile);
      return;
    }

    const simple = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (simple.data) {
      setProfile(simple.data as Profile);
      return;
    }

    const fallbackUser = user ?? (await supabase.auth.getUser()).data.user;
    if (!fallbackUser) {
      setProfile(null);
      return;
    }

    const fallback = profileFromUser(fallbackUser);
    await supabase.from('profiles').upsert({
      id: fallback.id,
      role: fallback.role,
      full_name: fallback.full_name,
      status: 'active',
    });
    setProfile(fallback);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      const uid = data.session?.user?.id;
      if (uid) {
        loadProfile(uid, data.session?.user).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true);
        }
        setSession(newSession);
        const uid = newSession?.user?.id;
        if (uid) {
          await loadProfile(uid, newSession.user);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const emailClean = email.trim();
    const passClean = password.trim().replace(/[\u2010-\u2015\u2212]/g, '-');
    const attempts = passClean.startsWith('-') && passClean.length > 1
      ? [passClean, passClean.slice(1)]
      : [passClean, `-${passClean}`];

    setLoading(true);

    let lastError: string | null = null;

    for (const pw of [...new Set(attempts)]) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailClean,
        password: pw,
      });
      if (!error && data.user) {
        setSession(data.session);
        await loadProfile(data.user.id, data.user);
        const { data: statusRow } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.user.id)
          .maybeSingle();
        if (statusRow?.status === 'deleted') {
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          setLoading(false);
          return { error: 'החשבון נמחק' };
        }
        setLoading(false);
        return { error: null };
      }
      lastError = error?.message ?? 'שגיאת התחברות';
    }

    setLoading(false);
    return { error: lastError };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  function exitRecovery() {
    setRecoveryMode(false);
  }

  async function reloadProfile() {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) await loadProfile(uid, data.session?.user);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, recoveryMode, signIn, signOut, exitRecovery, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
