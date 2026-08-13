import { useState, useEffect, useRef, Fragment } from 'react';
import { ChevronRight, ChevronLeft, MoreVertical, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Avatar, Badge, Card, SectionTitle } from '@/components/ui';
import { formatHebrewDate } from '@/lib/format';
import type { EmployeeRequest, Attendance } from '@/types';

export function RequestsTable({
  requests,
  onReload,
}: {
  requests: EmployeeRequest[];
  onReload: () => void;
}) {
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

  function flashToast(type: 'ok' | 'err', text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2500);
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setPendingId(id);
    const req = requests.find((r) => r.id === id);
    const { error } = await supabase.from('requests').update({ status }).eq('id', id);

    if (!error && req) {
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        title: status === 'approved' ? 'הבקשה שלך אושרה' : 'הבקשה שלך נדחתה',
        body: (status === 'approved' ? 'אושרה' : 'נדחתה') + ' — ' + req.type,
        read: false,
      });
    }

    setPendingId(null);
    onReload();

    if (error) {
      flashToast('err', 'שגיאה בעדכון הבקשה');
    } else {
      flashToast('ok', status === 'approved' ? 'הבקשה אושרה' : 'הבקשה נדחתה');
    }
  }

  async function saveResponse(id: string) {
    setPendingId(id);
    const req = requests.find((r) => r.id === id);
    const trimmed = note.trim();
    const { error } = await supabase
      .from('requests')
      .update({ manager_note: trimmed || null })
      .eq('id', id);

    if (!error && req && trimmed) {
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        title: 'תגובה לבקשה שלך',
        body: trimmed,
        read: false,
      });
    }

    setPendingId(null);
    setRespondingId(null);
    setNote('');
    onReload();

    if (error) {
      flashToast('err', 'שגיאה בשמירת התגובה');
    } else {
      flashToast('ok', 'התגובה נשמרה');
    }
  }

  async function deleteRequest(id: string) {
    setPendingId(id);

    const { data, error } = await supabase.from('requests').delete().eq('id', id).select('id');
    const deletedViaClient = !error && !!data && data.length > 0;

    if (!deletedViaClient) {
      const { data: sessionData } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-employee-request`;
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({ id }),
        });
        const result = (await res.json()) as { error?: string };
        if (!res.ok || result.error) {
          setPendingId(null);
          setConfirmDeleteId(null);
          flashToast('err', result.error ?? error?.message ?? 'שגיאה במחיקת הבקשה');
          return;
        }
      } catch {
        setPendingId(null);
        setConfirmDeleteId(null);
        flashToast('err', error?.message ?? 'שגיאה במחיקת הבקשה');
        return;
      }
    }

    setPendingId(null);
    setConfirmDeleteId(null);
    setHiddenIds((prev) => [...prev, id]);
    flashToast('ok', 'הבקשה נמחקה');
    onReload();
  }

  const visibleRequests = requests.filter((r) => !hiddenIds.includes(r.id));
  const confirmDeleteReq = visibleRequests.find((r) => r.id === confirmDeleteId);

  return (
    <Card className="flex flex-col">
      <SectionTitle
        title="בקשות מהעובדים"
        icon={<Inbox />}
        action={<Badge color="orange">{visibleRequests.filter((r) => r.status === 'pending').length} ממתינות</Badge>}
      />
      <div>
        {visibleRequests.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">אין בקשות</p>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">עובד</th>
                <th className="px-4 py-2.5 font-medium">סוג</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">תיאור</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">תאריך</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">תגובת מנהל</th>
                <th className="px-4 py-2.5 font-medium">סטטוס</th>
                <th className="px-4 py-2.5 font-medium">אישור בקשה</th>
                <th className="px-4 py-2.5 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...visibleRequests]
                .sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0))
                .map((r) => (
                <Fragment key={r.id}>
                <tr className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.profile?.full_name ?? '?'} size="sm" />
                      <span className="font-semibold text-slate-700">{r.profile?.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{r.type}</td>
                  <td className="hidden max-w-[14rem] px-4 py-2.5 text-slate-500 sm:table-cell">
                    <div className="truncate">{r.description || '—'}</div>
                    {r.manager_note && (
                      <div className="mt-0.5 truncate text-xs font-medium text-brand-700 lg:hidden">
                        תגובה: {r.manager_note}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-2.5 text-slate-500 md:table-cell">
                    {formatHebrewDate(r.requested_date)}
                  </td>
                  <td className="hidden max-w-[14rem] px-4 py-2.5 lg:table-cell">
                    {r.manager_note ? (
                      <span className="text-xs font-medium text-brand-700">{r.manager_note}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      color={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}
                    >
                      {r.status === 'approved' ? 'אושר' : r.status === 'rejected' ? 'נדחה' : 'ממתין'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateStatus(r.id, 'approved')}
                          disabled={pendingId === r.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                        >
                          אשר
                        </button>
                        <button
                          onClick={() => updateStatus(r.id, 'rejected')}
                          disabled={pendingId === r.id}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-40"
                        >
                          דחה
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="relative" ref={menuOpenId === r.id ? menuRef : undefined}>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                        disabled={pendingId === r.id}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
                        title="פעולות נוספות"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuOpenId === r.id && (
                        <div className="absolute left-0 top-full z-20 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                          <button
                            onClick={() => {
                              setRespondingId(r.id);
                              setNote(r.manager_note ?? '');
                              setMenuOpenId(null);
                            }}
                            className="flex w-full items-center px-3 py-2 text-right text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            תגובה לעובד
                          </button>
                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              setConfirmDeleteId(r.id);
                            }}
                            className="flex w-full items-center px-3 py-2 text-right text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                          >
                            מחק בקשה
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                {respondingId === r.id && (
                  <tr className="bg-brand-50/40">
                    <td colSpan={8} className="px-4 py-3">
                      <p className="mb-2 text-xs font-bold text-slate-600">תגובה לעובד</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="כתוב תגובה לעובד..."
                          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-100"
                          autoFocus
                        />
                        <button
                          onClick={() => saveResponse(r.id)}
                          disabled={pendingId === r.id || !note.trim()}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
                        >
                          שמור תגובה
                        </button>
                        <button
                          onClick={() => {
                            setRespondingId(null);
                            setNote('');
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-200"
                        >
                          ביטול
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {toast && (
        <div className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-bold shadow-lg ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'} animate-scale-in`}>
          {toast.text}
        </div>
      )}
      {confirmDeleteReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">מחיקת בקשה</h3>
            <p className="mt-2 text-sm text-slate-500">
              למחוק את הבקשה של{' '}
              <span className="font-bold text-slate-700">{confirmDeleteReq.profile?.full_name ?? 'העובד'}</span>
              {' '}({confirmDeleteReq.type})?
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={pendingId === confirmDeleteReq.id}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
              >
                ביטול
              </button>
              <button
                onClick={() => deleteRequest(confirmDeleteReq.id)}
                disabled={pendingId === confirmDeleteReq.id}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-40"
              >
                {pendingId === confirmDeleteReq.id ? 'מוחק...' : 'מחק בקשה'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

export function MissingAttendanceTable({
  attendance,
  onReload,
}: {
  attendance: Attendance[];
  onReload: () => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 6;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const flagged = attendance.filter((a) => {
    if (a.clock_out) return false;
    const day = new Date(a.clock_in);
    day.setHours(0, 0, 0, 0);
    return day.getTime() < todayMidnight.getTime();
  });
  const pages = Math.max(1, Math.ceil(flagged.length / pageSize));
  const current = flagged.slice(page * pageSize, page * pageSize + pageSize);

  async function correct(id: string) {
    await supabase.from('attendance').update({ status: 'approved' }).eq('id', id);
    onReload();
  }

  return (
    <Card className="flex flex-col">
      <SectionTitle
        title="עובדים עם יציאה חסרה מיום קודם"
        icon={<AlertTriangle />}
        action={<Badge color="red">{flagged.length} חריגים</Badge>}
      />
      <div className="max-h-[34rem] overflow-y-auto">
        {current.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">אין דיווחים חריגים</p>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">עובד</th>
                <th className="px-4 py-2.5 font-medium">תאריך</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">בעיה</th>
                <th className="px-4 py-2.5 font-medium">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {current.map((a) => {
                const issue = 'יציאה חסרה';
                return (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={a.profile?.full_name ?? '?'} size="sm" />
                        <span className="font-semibold text-slate-700">{a.profile?.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{formatHebrewDate(a.clock_in)}</td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      <Badge color="amber">{issue}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => correct(a.id)}
                        className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-200"
                      >
                        תקן דיווח
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {flagged.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          <span>
            עמוד {page + 1} מתוך {pages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// inline icon imports to avoid extra files
import { Inbox, AlertTriangle } from 'lucide-react';
