import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import Login from '@/pages/Login';
import EmployeeView from '@/pages/EmployeeView';
import ManagerView from '@/pages/ManagerView';
import ResetPassword from '@/pages/ResetPassword';

function Router() {
  const { session, profile, loading, recoveryMode } = useAuth();

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

  if (!session || !profile) {
    return <Login />;
  }

  return profile.role === 'manager' ? <ManagerView /> : <EmployeeView />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
