import {
  Users,
  Plane,
  HeartPulse,
  CakeSlice,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Card } from '@/components/ui';
import type { Profile } from '@/types';

export default function KpiCards({ profiles }: { profiles: Profile[] }) {
  const employees = profiles.filter((p) => p.role === 'employee');
  const now = new Date();
  const month = now.getMonth();
  const birthdaysThisMonth = employees.filter((p) => {
    if (!p.birth_date) return false;
    const d = new Date(p.birth_date);
    return d.getMonth() === month;
  });

  const cards: {
    label: string;
    value: string;
    sub: string;
    icon: ComponentType<LucideProps>;
    bg: string;
    iconBg: string;
  }[] = [
    {
      label: 'עובדים בחברה',
      value: `${employees.length}`,
      sub: 'סה"כ עובדים פעילים',
      icon: Users,
      bg: 'from-brand-500 to-brand-700',
      iconBg: 'bg-white/20',
    },
    {
      label: 'ימי חופשה נוצלו החודש',
      value: '7',
      sub: 'מתוך מאגר שנתי',
      icon: Plane,
      bg: 'from-emerald-500 to-emerald-700',
      iconBg: 'bg-white/20',
    },
    {
      label: 'ימי מחלה נוצלו החודש',
      value: '3',
      sub: 'דיווחי מחלה אושרו',
      icon: HeartPulse,
      bg: 'from-rose-500 to-rose-700',
      iconBg: 'bg-white/20',
    },
    {
      label: 'חוגגים יום הולדת החודש',
      value: `${birthdaysThisMonth.length}`,
      sub: birthdaysThisMonth.map((p) => p.full_name).join(', ') || 'אין ימי הולדת',
      icon: CakeSlice,
      bg: 'from-accent-500 to-accent-700',
      iconBg: 'bg-white/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => (
        <Card
          key={c.label}
          className={`animate-fade-in-up relative overflow-hidden bg-gradient-to-br ${c.bg} border-transparent text-white`}
        >
          <div className="p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">{c.label}</p>
                <p className="mt-2 text-3xl font-extrabold">{c.value}</p>
                <p className="mt-1 truncate text-xs text-white/70">{c.sub}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${c.iconBg}`}>
                <c.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10" />
        </Card>
      ))}
    </div>
  );
}
