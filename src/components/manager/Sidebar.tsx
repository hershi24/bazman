import { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { MENU, type MenuGroup } from '@/lib/menu';

export default function Sidebar({
  collapsed,
  onNavigate,
  activeKey,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onNavigate: (key: string) => void;
  activeKey: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // expand the group containing the active key by default
    const init: Record<string, boolean> = {};
    for (const g of MENU) {
      if (g.children.some((c) => c.key === activeKey)) init[g.key] = true;
    }
    return init;
  });

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onCloseMobile} />
      )}

      <aside
        className={`sidebar-transition fixed top-0 bottom-0 right-0 z-50 flex h-full flex-col border-l border-slate-200 bg-white lg:static lg:z-30 ${
          collapsed ? 'lg:w-[72px]' : 'lg:w-64'
        } ${mobileOpen ? 'translate-x-0 w-64' : 'translate-x-full lg:translate-x-0'}`}
      >
        {/* Mobile close */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4 lg:hidden">
          <span className="font-extrabold text-slate-800">תפריט</span>
          <button onClick={onCloseMobile} className="text-slate-400 hover:text-slate-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {MENU.map((group) => (
            <SidebarGroup
              key={group.key}
              group={group}
              collapsed={collapsed}
              open={!!openGroups[group.key]}
              onToggle={() => toggleGroup(group.key)}
              onNavigate={(k) => {
                onNavigate(k);
                onCloseMobile();
              }}
              activeKey={activeKey}
            />
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3 text-center">
          {!collapsed && <p className="text-[11px] text-slate-400">BeZman v1.0</p>}
        </div>
      </aside>
    </>
  );
}

function SidebarGroup({
  group,
  collapsed,
  open,
  onToggle,
  onNavigate,
  activeKey,
}: {
  group: MenuGroup;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: (key: string) => void;
  activeKey: string;
}) {
  const hasActive = group.children.some((c) => c.key === activeKey);

  if (collapsed) {
    // collapsed: show only group icon, expand on hover via title
    return (
      <div className="group relative px-2 py-1">
        <button
          onClick={onToggle}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            hasActive ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-100'
          }`}
          title={group.label}
        >
          <group.icon className="h-5 w-5" />
        </button>
      </div>
    );
  }

  const single = group.children.length === 1;

  return (
    <div className="px-2 py-1">
      <button
        onClick={() => (single ? onNavigate(group.children[0].key) : onToggle())}
        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
          hasActive ? 'text-brand-700' : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <group.icon className={`h-5 w-5 ${hasActive ? 'text-brand-600' : 'text-slate-400'}`} />
          {group.label}
        </span>
        {!single && (
          <ChevronLeft className={`h-4 w-4 text-slate-400 transition ${open ? '-rotate-90' : ''}`} />
        )}
      </button>
      {open && !single && (
        <div className="mr-4 mt-1 space-y-0.5 border-r border-slate-100 pr-3 animate-fade-in">
          {group.children.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                activeKey === item.key
                  ? 'bg-brand-50 font-bold text-brand-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
