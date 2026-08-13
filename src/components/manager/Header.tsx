import { useState } from 'react';
import {
  Bell,
  FileText,
  LifeBuoy,
  Settings,
  LogOut,
  Clock,
  ChevronDown,
  Menu as MenuIcon,
  Search,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/ui';
import type { AppNotification } from '@/types';
import { formatTime } from '@/lib/format';

export default function Header({
  onToggleSidebar,
  onHome,
  search,
  onSearch,
}: {
  onToggleSidebar: () => void;
  onHome: () => void;
  search: string;
  onSearch: (v: string) => void;
}) {
  const { profile, signOut } = useAuth();
  const [openNotif, setOpenNotif] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadedNotif, setLoadedNotif] = useState(false);

  async function loadNotifications() {
    if (loadedNotif) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8);
    setNotifications((data as AppNotification[]) ?? []);
    setLoadedNotif(true);
  }

  const unread = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifications').update({ read: true }).in('id', ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm">
      {/* Right (RTL start): brand + toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
          title="תפריט"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <button onClick={onHome} className="flex items-center gap-2.5 transition hover:opacity-80" title="חזרה לעמוד הראשי">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow">
            <Clock className="h-5 w-5" />
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-base font-extrabold leading-tight text-slate-800">BeZman</p>
            <p className="text-[11px] text-slate-400">פתרונות נוכחות לעסקים · גליצקי פתרונות טכנולוגיים</p>
          </div>
        </button>
      </div>

      {/* Center: search */}
      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="חיפוש עובד לפי שם או מספר..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-9 pl-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:bg-white"
        />
      </div>

      {/* Left (RTL end): utilities + profile */}
      <div className="flex items-center gap-1.5">
        <UtilityBtn icon={FileText} label="דוחות" />
        <a
          href="mailto:e0583296967@gmail.com"
          title="תמיכה: e0583296967@gmail.com"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
        >
          <LifeBuoy className="h-5 w-5" />
        </a>
        <UtilityBtn icon={Settings} label="הגדרות" />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setOpenNotif((v) => !v);
              loadNotifications();
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
            title="התראות"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {openNotif && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenNotif(false)} />
              <div className="absolute left-0 top-11 z-20 w-80 animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="font-bold text-slate-800">התראות</p>
                  <button onClick={markAllRead} className="text-xs font-medium text-brand-600 hover:underline">
                    סמן הכל כנקרא
                  </button>
                </div>
                <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">אין התראות</p>
                  )}
                  {notifications.map((n) => (
                    <div key={n.id} className={`flex gap-3 px-4 py-3 ${n.read ? '' : 'bg-brand-50/50'}`}>
                      <div
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-300' : 'bg-accent-500'}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700">{n.title}</p>
                        {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
                        <p className="mt-0.5 text-[11px] text-slate-400">{formatTime(n.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile */}
        <div className="mr-1 flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-slate-100">
          <Avatar name={profile?.full_name ?? 'מנהל'} size="sm" />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold leading-tight text-slate-700">{profile?.full_name}</p>
            <p className="text-[11px] text-slate-400">מנהל מערכת</p>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          <button
            onClick={signOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            title="התנתק"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function UtilityBtn({ icon: Icon, label }: { icon: typeof Bell; label: string }) {
  return (
    <button
      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
      title={label}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
