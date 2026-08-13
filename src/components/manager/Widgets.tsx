import { useState } from 'react';
import { CalendarCheck, Bell, Check, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Avatar, Badge, Card, SectionTitle } from '@/components/ui';
import { formatTime, relativeDays } from '@/lib/format';
import type { Attendance, Reminder } from '@/types';
import { useAuth } from '@/lib/auth';

export function TodayAttendance({ attendance }: { attendance: Attendance[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRows = attendance.filter((a) => {
    if (!a.clock_in) return false;
    return new Date(a.clock_in) >= today;
  });
  const present = todayRows.filter((a) => a.clock_in && !a.clock_out);

  return (
    <Card>
      <SectionTitle
        title="נוכחות מהיום"
        icon={<CalendarCheck className="h-5 w-5" />}
        action={<Badge color="green">{present.length} נוכחים</Badge>}
      />
      <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
        {todayRows.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">אין דיווחים היום</p>
        )}
        {todayRows.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={a.profile?.full_name ?? '?'} size="sm" />
              <div>
                <p className="text-sm font-semibold text-slate-700">{a.profile?.full_name}</p>
                <p className="text-[11px] text-slate-400">
                  {formatTime(a.clock_in)} → {formatTime(a.clock_out) || '...'}
                </p>
              </div>
            </div>
            <Badge color={a.clock_in && !a.clock_out ? 'green' : 'slate'}>
              {a.clock_in && !a.clock_out ? 'נוכח' : 'יצא'}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ManagerReminders({
  reminders,
  onReload,
}: {
  reminders: Reminder[];
  onReload: () => void;
}) {
  const { profile } = useAuth();
  const sorted = [...reminders].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.due_date ?? '').getTime() - new Date(b.due_date ?? '').getTime();
  });

  async function toggle(id: string, done: boolean) {
    await supabase.from('reminders').update({ done: !done }).eq('id', id);
    onReload();
  }

  async function add() {
    const title = window.prompt('תיאור תזכורת חדשה:');
    if (!title || !profile) return;
    await supabase.from('reminders').insert({
      user_id: profile.id,
      title,
      due_date: new Date().toISOString().slice(0, 10),
      done: false,
    });
    onReload();
  }

  return (
    <Card>
      <SectionTitle
        title="תזכורות למנהל"
        icon={<Bell className="h-5 w-5" />}
        action={
          <button
            onClick={add}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600 transition hover:bg-brand-200"
            title="תזכורת חדשה"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      />
      <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">אין תזכורות</p>
        )}
        {sorted.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
            <button
              onClick={() => toggle(r.id, r.done)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                r.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-brand-400'
              }`}
            >
              {r.done && <Check className="h-3 w-3" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${r.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                {r.title}
              </p>
              {r.due_date && (
                <p className="text-[11px] text-slate-400">{relativeDays(r.due_date)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
