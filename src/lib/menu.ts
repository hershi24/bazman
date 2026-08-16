import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  MapPin,
  ClipboardList,
  Users,
  Inbox,
  BarChart3,
  Settings,
  UserPlus,
  List,
  Network,
  UserCheck,
  UserCog,
  Bell,
  RotateCcw,
  UserX,
  FileText,
  Table,
  CalendarCheck,
  Route,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type MenuItem = {
  label: string;
  icon: ComponentType<LucideProps>;
  key: string;
};

export type MenuGroup = {
  label: string;
  icon: ComponentType<LucideProps>;
  key: string;
  children: MenuItem[];
};

export const MENU: MenuGroup[] = [
  {
    label: 'הפעלות שלי',
    icon: LayoutDashboard,
    key: 'my-activities',
    children: [{ label: 'לוח ראשי', icon: LayoutDashboard, key: 'dashboard' }],
  },
  {
    label: 'ניהול דיווחים',
    icon: ClipboardList,
    key: 'reports-mgmt',
    children: [
      { label: 'ניהול דיווחים לעובד', icon: ClipboardList, key: 'employee-reports' },
      { label: 'דיווחים מיוחדים', icon: FileText, key: 'special-reports' },
      { label: 'מקומות מותרים לדיווח', icon: MapPin, key: 'allowed-locations' },
      { label: 'מסלולי מיקום GPS', icon: Route, key: 'gps-routes' },
    ],
  },
  {
    label: 'עובדים',
    icon: Users,
    key: 'employees',
    children: [
      { label: 'הוסף עובד חדש', icon: UserPlus, key: 'add-employee' },
      { label: 'רשימת עובדים', icon: List, key: 'employee-list' },
      { label: 'ניהול מחלקות', icon: Network, key: 'departments' },
      { label: 'עובדים שנוכחים כרגע', icon: UserCheck, key: 'present-employees' },
      { label: 'ניהול שדות פרופיל עובד', icon: UserCog, key: 'profile-fields' },
      { label: 'תזכורות למנהל', icon: Bell, key: 'manager-reminders' },
      { label: 'שחזור עובדים שנמחקו', icon: RotateCcw, key: 'restore-employees' },
      { label: 'עובדים ללא דיווחים', icon: UserX, key: 'no-reports' },
    ],
  },
  {
    label: 'בקשות מהעובדים',
    icon: Inbox,
    key: 'requests',
    children: [{ label: 'בקשות מהעובדים', icon: Inbox, key: 'requests-list' }],
  },
  {
    label: 'דוחות',
    icon: BarChart3,
    key: 'reports',
    children: [
      { label: 'דו"ח חודשי', icon: Table, key: 'monthly-detail' },
      { label: 'דו"ח נוכחות יומי', icon: CalendarCheck, key: 'daily-attendance' },
      { label: 'דו"ח יומי מפורט', icon: FileText, key: 'daily-detail' },
    ],
  },
  {
    label: 'הגדרות גלובליות',
    icon: Settings,
    key: 'settings',
    children: [
      { label: 'הגדרות גלובליות', icon: Settings, key: 'global-settings' },
      { label: 'הוסף מנהל למערכת', icon: UserPlus, key: 'add-manager' },
      { label: 'הגדרות חשבון', icon: UserCog, key: 'account-settings' },
    ],
  },
];

export const _icons: Record<string, LucideIcon> = { MapPin };
