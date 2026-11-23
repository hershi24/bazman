import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LanguageProvider } from '@/lib/LanguageProvider';
import Login from '@/pages/Login';
import EmployeeView from '@/pages/EmployeeView';
import ManagerView from '@/pages/ManagerView';
import ResetPassword from '@/pages/ResetPassword';

function AppShell() {
  const { session, profile, loading, recoveryMode, signOut } = useAuth();

  useEffect(() => {
    if (profile?.status === 'deleted') {
      void signOut();
    }
  }, [profile?.status, signOut]);

  const metaRole = session?.user.user_metadata?.role;
  const email = session?.user.email?.toLowerCase();
  const isDeleted = profile?.status === 'deleted';
  const isManager =
    !!session &&
    !isDeleted &&
    (profile?.role === 'manager' || metaRole === 'manager' || email === 'e0583296967@gmail.com');

  return (
    <LanguageProvider lockHebrew={isManager}>
      <Router
        loading={loading}
        recoveryMode={recoveryMode}
        session={!!session}
        profileLoaded={!!profile}
        isDeleted={isDeleted}
        isManager={isManager}
      />
    </LanguageProvider>
  );
}

function Router({
  loading,
  recoveryMode,
  session,
  profileLoaded,
  isDeleted,
  isManager,
}: {
  loading: boolean;
  recoveryMode: boolean;
  session: boolean;
  profileLoaded: boolean;
  isDeleted: boolean;
  isManager: boolean;
}) {
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (recoveryMode) {
    return <ResetPassword />;
  }

  if (!session || isDeleted) {
    return <Login />;
  }

  if (!profileLoaded && !isManager) {
    return <Login />;
  }

  return isManager ? <ManagerView /> : <EmployeeView />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
