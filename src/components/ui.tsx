import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { initials, avatarColor } from '@/lib/format';

export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sz = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm';
  if (src) {
    return <img src={src} alt={name} className={`${sz} rounded-full object-cover`} />;
  }
  return (
    <div
      className={`${sz} ${avatarColor(name)} flex items-center justify-center rounded-full font-semibold text-white select-none`}
    >
      {initials(name)}
    </div>
  );
}

export function Badge({
  children,
  color = 'slate',
}: {
  children: ReactNode;
  color?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'orange';
}) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-rose-100 text-rose-700',
    blue: 'bg-brand-100 text-brand-700',
    orange: 'bg-accent-100 text-accent-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${map[color]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-card ${className}`}>{children}</div>
  );
}

export function TruncatedText({ text, className = '' }: { text: string; className?: string }) {
  const [tip, setTip] = useState<{ top: number; right: number } | null>(null);
  if (!text.trim()) return <span className={className}>—</span>;

  return (
    <>
      <span
        className={`block max-w-full cursor-help truncate ${className}`}
        onMouseEnter={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setTip({ top: box.bottom + 6, right: window.innerWidth - box.right });
        }}
        onMouseLeave={() => setTip(null)}
      >
        {text}
      </span>
      {tip
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[200] max-w-sm rounded-xl bg-slate-800 px-3 py-2 text-right text-xs font-medium leading-relaxed text-white shadow-xl"
              style={{ top: tip.top, right: tip.right }}
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function SectionTitle({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-brand-600">{icon}</span>}
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
      </div>
      {action}
    </div>
  );
}
