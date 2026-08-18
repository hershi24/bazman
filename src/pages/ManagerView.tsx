import { useEffect, useState, type ReactNode } from 'react';
import { Plus, X, UserPlus, Bell, FileText, ClipboardList, Pencil, Trash2, Save, Search, MapPin, AlertTriangle, Clock, Check, CheckSquare, Briefcase, Settings, Network, UserCog, Mail, Lock, Loader2, QrCode, Printer, KeyRound, Copy } from 'lucide-react';
import MapPicker from '@/components/MapPicker';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/lib/auth';
import { useManagerData } from '@/lib/useManagerData';
import { supabase } from '@/lib/supabase';
import { updateUserAuth } from '@/lib/updateAuth';
import { createStaffUser } from '@/lib/createStaffUser';
import { loadManagerEmails, loadManagerEmailsFromServer, loadManagerPasswords, rememberManagerEmail, saveManagerLoginEmail, saveManagerLoginPassword } from '@/lib/managerPasswords';
import { isDeveloperSession, isHiddenDeveloperProfile } from '@/lib/developerAccount';
import Header from '@/components/manager/Header';
import Sidebar from '@/components/manager/Sidebar';
import KpiCards from '@/components/manager/KpiCards';
import { RequestsTable, MissingAttendanceTable } from '@/components/manager/DashboardTables';
import { TodayAttendance, ManagerReminders } from '@/components/manager/Widgets';
import { Card, SectionTitle, Avatar, Badge } from '@/components/ui';
import WorkHoursSummary from '@/components/manager/WorkHoursSummary';
import { managerDeleteAttendance, managerInsertAttendance } from '@/lib/managerAttendance';
import { formatHebrewDate, formatTime, hoursBetween } from '@/lib/format';
import { formatChangeRequestsPlain, requestsForAttendanceDay } from '@/lib/monthlyReport';
import type { Profile, Attendance, Shift, EmployeeRequest, Reminder, Expense, QuickSticker, ProfileField, AllowedLocation, EmployeeLocation, Department } from '@/types';

export default function ManagerView() {
  const data = useManagerData();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeKey, setActiveKey] = useState('dashboard');
  const [search, setSearch] = useState('');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar
        collapsed={collapsed}
        onNavigate={setActiveKey}
        activeKey={activeKey}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleSidebar={() => {
            if (window.innerWidth < 1024) {
              setMobileOpen(true);
            } else {
              setCollapsed((v) => !v);
            }
          }}
          onHome={() => setActiveKey('dashboard')}
          search={search}
          onSearch={(v) => {
            setSearch(v);
            if (v && activeKey !== 'employee-list') setActiveKey('employee-list');
          }}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {activeKey === 'dashboard' ? (
            <Dashboard data={data} />
          ) : (
            <GenericPage activeKey={activeKey} data={data} onNavigate={setActiveKey} search={search} />
          )}
          <footer className="mt-6 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400">
          <p>
            פותח על ידי <span className="font-semibold text-slate-500">גליצקי פתרונות טכנולוגיים לעסקים</span>
          </p>
          </footer>
        </main>
      </div>

    </div>
  );
}

function Dashboard({ data }: { data: ReturnType<typeof useManagerData> }) {
  if (data.loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-slate-800">לוח בקרה</h1>
        <p className="text-sm text-slate-500">סקירה כללית של נוכחות, בקשות ומשמרות — {formatHebrewDate(new Date())}</p>
      </div>

      <KpiCards profiles={data.profiles} />

      <RequestsTable requests={data.requests} onReload={data.reload} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MissingAttendanceTable attendance={data.attendance} onReload={data.reload} />
        <TodayAttendance attendance={data.attendance} />
      </div>

      <ManagerReminders reminders={data.reminders} onReload={data.reload} />
    </div>
  );
}

function GenericPage({
  activeKey,
  data,
  onNavigate,
  search,
}: {
  activeKey: string;
  data: ReturnType<typeof useManagerData>;
  onNavigate: (key: string) => void;
  search: string;
}) {
  const renderers: Record<string, React.ReactNode> = {
    'employee-list': <EmployeeList profiles={data.profiles} departments={data.departments} onReload={data.reload} onNavigate={onNavigate} externalSearch={search} />,
    'present-employees': <PresentEmployees attendance={data.attendance} />,
    'requests-list': <RequestsFullPage requests={data.requests} onReload={data.reload} />,
    'allowed-locations': <AllowedLocations locations={data.allowedLocations} employeeLocations={data.employeeLocations} profiles={data.profiles} onReload={data.reload} />,
    'add-employee': <AddEmployee departments={data.departments} onReload={data.reload} />,
    'departments': <DepartmentsPage departments={data.departments} onReload={data.reload} />,
    'exceptions': <ExceptionsPage attendance={data.attendance} onReload={data.reload} />,
    'employee-reports': <EmployeeReportsPage attendance={data.attendance} profiles={data.profiles} onReload={data.reload} />,
    'special-reports': <SpecialReportsPage attendance={data.attendance} profiles={data.profiles} />,
    'role-project': <RoleProjectPage shifts={data.shifts} profiles={data.profiles} />,
    'report-reminders': <ReportRemindersPage reminders={data.reminders} onReload={data.reload} />,
    'quick-stickers': <QuickStickersPage />,
    'gps-routes': <GpsRoutesPage attendance={data.attendance} />,
    'profile-fields': <ProfileFieldsPage fields={data.profileFields} onReload={data.reload} />,
    'manager-reminders': <ManagerRemindersFullPage reminders={data.reminders} onReload={data.reload} />,
    'restore-employees': <RestoreEmployeesPage profiles={data.profiles} onReload={data.reload} />,
    'no-reports': <NoReportsPage attendance={data.attendance} profiles={data.profiles} />,
    'monthly-detail': <WorkHoursSummary attendance={data.attendance} profiles={data.profiles} requests={data.requests} onReload={data.reload} />,
    'compare-shifts': <CompareShiftsPage shifts={data.shifts} attendance={data.attendance} profiles={data.profiles} />,
    'daily-attendance': <DailyAttendancePage attendance={data.attendance} />,
    'summary-export': <SummaryExportPage attendance={data.attendance} profiles={data.profiles} expenses={data.expenses} />,
    'absences': <AbsencesPage attendance={data.attendance} profiles={data.profiles} />,
    'by-project': <ByProjectPage shifts={data.shifts} attendance={data.attendance} />,
    'by-shift': <ByShiftPage shifts={data.shifts} />,
    'late-report': <LateReportPage attendance={data.attendance} profiles={data.profiles} />,
    'daily-detail': <DailyDetailPage attendance={data.attendance} requests={data.requests} />,
    'sign-reports': <SignReportsPage attendance={data.attendance} onReload={data.reload} />,
    'global-settings': <GlobalSettingsPage />,
    'add-manager': <AddManagerForm profiles={data.profiles} onReload={data.reload} />,
    'account-settings': <AccountSettingsPage />,
  };

  return (
    <div className="mx-auto max-w-7xl">
      {renderers[activeKey] ?? <PlaceholderPage activeKey={activeKey} />}
    </div>
  );
}

function PlaceholderPage({ activeKey }: { activeKey: string }) {
  return (
    <Card className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        <FileText className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-700">מודול זה בפיתוח</h2>
      <p className="mt-1 text-sm text-slate-500">הדף שבחרת יהיה זמין בקרוב.</p>
      <p className="mt-2 text-xs text-slate-400">מזהה: {activeKey}</p>
    </Card>
  );
}

/* ==================== EMPLOYEE LIST with EDIT/DELETE ==================== */

function EmployeeList({
  profiles,
  departments,
  onReload,
  onNavigate,
  externalSearch,
}: {
  profiles: Profile[];
  departments: { id: string; name: string }[];
  onReload: () => void;
  onNavigate: (key: string) => void;
  externalSearch?: string;
}) {
  const [localSearch, setLocalSearch] = useState('');
  const [editing, setEditing] = useState<Profile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  const search = externalSearch ?? localSearch;
  const employees = profiles.filter(
    (p) =>
      p.status === 'active' &&
      p.role === 'employee' &&
      !isHiddenDeveloperProfile(p) &&
      (p.full_name.includes(search) || (p.employee_number ?? '').includes(search)),
  );
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? '—';

  async function doDelete(p: Profile) {
    await supabase.from('profiles').update({ status: 'deleted' }).eq('id', p.id);
    setConfirmDelete(null);
    onReload();
  }

  return (
    <>
      <Card>
        <SectionTitle
          title="רשימת עובדים"
          icon={<UserPlus className="h-5 w-5" />}
          action={
            <button
              onClick={() => onNavigate('add-employee')}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              הוסף עובד
            </button>
          }
        />
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="חיפוש עובד לפי שם או מספר..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pr-10 pl-4 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">עובד</th>
                <th className="px-4 py-2.5 font-medium">מספר</th>
                <th className="px-4 py-2.5 font-medium">מחלקה</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">טלפון</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">תאריך הצטרפות</th>
                <th className="px-4 py-2.5 font-medium">סטטוס</th>
                <th className="px-4 py-2.5 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">לא נמצאו עובדים</td>
                </tr>
              )}
              {employees.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={p.full_name} size="sm" />
                      <div>
                        <span className="font-semibold text-slate-700">{p.full_name}</span>
                        {p.role === 'manager' && (
                          <span className="mr-2 text-[11px] font-bold text-brand-600">מנהל</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{p.employee_number ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{deptName(p.department_id)}</td>
                  <td className="hidden px-4 py-2.5 text-slate-500 sm:table-cell">{p.phone ?? '—'}</td>
                  <td className="hidden px-4 py-2.5 text-slate-500 md:table-cell">{formatHebrewDate(p.hire_date)}</td>
                  <td className="px-4 py-2.5">
                    <Badge color={p.status === 'active' ? 'green' : 'red'}>
                      {p.status === 'active' ? 'פעיל' : 'מחוק'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-brand-100 hover:text-brand-700"
                        title="ערוך פרטים"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {p.role !== 'manager' && (
                        <button
                          onClick={() => setConfirmDelete(p)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-rose-100 hover:text-rose-600"
                          title="מחק עובד"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <EditEmployeeModal
          profile={editing}
          departments={departments}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onReload();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          name={confirmDelete.full_name}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => doDelete(confirmDelete)}
        />
      )}
    </>
  );
}

function EditEmployeeModal({
  profile,
  departments,
  onClose,
  onSaved,
}: {
  profile: Profile;
  departments: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [employeeNumber, setEmployeeNumber] = useState(profile.employee_number ?? '');
  const [departmentId, setDepartmentId] = useState(profile.department_id ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? '');
  const [hireDate, setHireDate] = useState(profile.hire_date ?? '');
  const [status, setStatus] = useState(profile.status);
  const [workDaysEnabled, setWorkDaysEnabled] = useState((profile.work_days?.length ?? 0) > 0);
  const [workDays, setWorkDays] = useState<number[]>(profile.work_days ?? [0, 1, 2, 3, 4]);
  const [quotaType, setQuotaType] = useState<'daily' | 'weekly' | 'monthly' | 'none'>(profile.hours_quota_type ?? 'none');
  const [hoursQuota, setHoursQuota] = useState(profile.hours_quota != null ? String(profile.hours_quota) : '');
  const [overtimeEligible, setOvertimeEligible] = useState(profile.overtime_eligible ?? false);
  const [overtimeThreshold, setOvertimeThreshold] = useState(profile.overtime_threshold != null ? String(profile.overtime_threshold) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const dayLabels = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayShort = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  function toggleDay(day: number) {
    setWorkDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        employee_number: employeeNumber || null,
        department_id: departmentId || null,
        phone: phone || null,
        birth_date: birthDate || null,
        hire_date: hireDate || null,
        status,
        work_days: workDaysEnabled ? workDays : null,
        hours_quota_type: quotaType === 'none' ? null : quotaType,
        hours_quota: quotaType === 'none' || hoursQuota === '' ? null : parseFloat(hoursQuota) || null,
        overtime_eligible: overtimeEligible,
        overtime_threshold: overtimeEligible && overtimeThreshold !== '' ? parseFloat(overtimeThreshold) || null : null,
      })
      .eq('id', profile.id);
    if (error) {
      setErr(error.message);
      setBusy(false);
    } else {
      onSaved();
    }
  }

  async function saveAuth() {
    if (isHiddenDeveloperProfile(profile)) {
      setAuthMsg({ type: 'err', text: 'לא ניתן לשנות את חשבון המפתחים.' });
      return;
    }
    setAuthBusy(true);
    setAuthMsg(null);
    const payload: { userId: string; email?: string; password?: string } = { userId: profile.id };
    if (newEmail.trim()) payload.email = newEmail.trim();
    if (newPassword.trim()) payload.password = newPassword.trim();

    if (!payload.email && !payload.password) {
      setAuthMsg({ type: 'err', text: 'נא למלא לפחות אחד מהשדות.' });
      setAuthBusy(false);
      return;
    }

    if (payload.password && payload.password.length < 6) {
      setAuthMsg({ type: 'err', text: 'הסיסמה חייבת להכיל לפחות 6 תווים.' });
      setAuthBusy(false);
      return;
    }

    const { error } = await updateUserAuth(payload);

    if (error) {
      setAuthMsg({ type: 'err', text: error });
    } else {
      setAuthMsg({ type: 'ok', text: 'האימייל/הסיסמה עודכנו. אפשר להתחבר מיד עם הפרטים החדשים.' });
      setNewEmail('');
      setNewPassword('');
    }
    setAuthBusy(false);
  }

  return (
    <Modal title="עריכת עובד" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ModalField label="שם מלא" value={fullName} onChange={setFullName} />
        <ModalField label="מספר עובד" value={employeeNumber} onChange={setEmployeeNumber} />
        <ModalField label="טלפון" value={phone} onChange={setPhone} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">מחלקה</label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white"
          >
            <option value="">— ללא —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <ModalField label="תאריך לידה" type="date" value={birthDate} onChange={setBirthDate} />
        <ModalField label="תאריך הצטרפות" type="date" value={hireDate} onChange={setHireDate} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">סטטוס</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'deleted')}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white"
          >
            <option value="active">פעיל</option>
            <option value="deleted">מחוק</option>
          </select>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-3 text-sm font-bold text-slate-700">הגדרות עבודה</p>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">ימי עבודה בשבוע</label>
            <button
              type="button"
              onClick={() => setWorkDaysEnabled(!workDaysEnabled)}
              className={`relative h-6 w-11 rounded-full transition ${workDaysEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${workDaysEnabled ? 'right-1' : 'right-6'}`} />
            </button>
          </div>
          {workDaysEnabled && (
            <div className="flex flex-wrap gap-2">
              {dayLabels.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition ${
                    workDays.includes(idx)
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                  title={day}
                >
                  {dayShort[idx]}
                </button>
              ))}
            </div>
          )}
          {!workDaysEnabled && (
            <p className="text-sm text-slate-400">לא מוגדרים ימי עבודה קבועים</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">סוג מכסת שעות</label>
            <select
              value={quotaType}
              onChange={(e) => setQuotaType(e.target.value as 'daily' | 'weekly' | 'monthly' | 'none')}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white"
            >
              <option value="none">לא מוגדר</option>
              <option value="daily">ליום</option>
              <option value="weekly">לשבוע</option>
              <option value="monthly">לחודש</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              כמות שעות {quotaType === 'daily' ? 'ליום' : quotaType === 'weekly' ? 'לשבוע' : quotaType === 'monthly' ? 'לחודש' : ''}
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={hoursQuota}
              onChange={(e) => setHoursQuota(e.target.value)}
              disabled={quotaType === 'none'}
              placeholder={quotaType === 'none' ? 'לא מוגדר' : ''}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-50 disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOvertimeEligible(!overtimeEligible)}
            className={`relative h-7 w-12 rounded-full transition ${overtimeEligible ? 'bg-brand-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${overtimeEligible ? 'right-1' : 'right-6'}`}
            />
          </button>
          <span className="text-sm font-medium text-slate-700">זכאי לשעות נוספות</span>
        </div>

        {overtimeEligible && (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              סף שעות נוספות ({quotaType === 'daily' ? 'ליום' : quotaType === 'weekly' ? 'לשבוע' : quotaType === 'monthly' ? 'לחודש' : ''})
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={overtimeThreshold}
              onChange={(e) => setOvertimeThreshold(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </div>
        )}
      </div>

      {isHiddenDeveloperProfile(profile) ? (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">חשבון מפתחים — אימייל וסיסמה קבועים ולא ניתנים לשינוי.</p>
      ) : (
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-1 text-sm font-bold text-slate-700">הגדרות מתקדמות — אימייל וסיסמה</p>
        <p className="mb-3 text-xs text-slate-400">העדכון נשמר מיד בחשבון ההתחברות, בלי לשלוח מייל אישור.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">אימייל חדש</label>
            <input
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="השאר ריק כדי לא לשנות"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-left text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">סיסמה חדשה</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="השאר ריק כדי לא לשנות"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        {authMsg && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${authMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
            {authMsg.text}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button
            onClick={saveAuth}
            disabled={authBusy}
            className="flex items-center gap-1.5 rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            עדכן אימייל/סיסמה
          </button>
        </div>
      </div>
      )}

      {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100">ביטול</button>
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {busy ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </Modal>
  );
}

function ConfirmDeleteModal({
  name,
  onCancel,
  onConfirm,
  title = 'מחיקת עובד',
  description,
  confirmLabel = 'מחק עובד',
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <Trash2 className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">
          {description ?? (
            <>
              האם אתה בטוח שברצונך למחוק את <span className="font-bold text-slate-700">{name}</span>?
              ניתן יהיה לשחזר את העובד מאוחר יותר.
            </>
          )}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100">ביטול</button>
          <button onClick={onConfirm} className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700">{confirmLabel}</button>
        </div>
      </Card>
    </div>
  );
}

/* ==================== SHARED MODAL & FIELD ==================== */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}

/* ==================== OTHER PAGES ==================== */

function PresentEmployees({ attendance }: { attendance: Attendance[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const present = attendance.filter((a) => a.clock_in && new Date(a.clock_in) >= today && !a.clock_out);
  return (
    <Card>
      <SectionTitle title="עובדים שנוכחים כרגע" icon={<UserPlus className="h-5 w-5" />} action={<Badge color="green">{present.length} נוכחים</Badge>} />
      <div className="divide-y divide-slate-100">
        {present.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">אין עובדים נוכחים כעת</p>}
        {present.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={a.profile?.full_name ?? '?'} size="sm" />
              <div>
                <p className="text-sm font-semibold text-slate-700">{a.profile?.full_name}</p>
                <p className="text-[11px] text-slate-400">נכנס {formatTime(a.clock_in)}</p>
              </div>
            </div>
            <Badge color="green">נוכח</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RequestsFullPage({ requests, onReload }: { requests: EmployeeRequest[]; onReload: () => void }) {
  return (
    <div className="space-y-4">
      <RequestsTable requests={requests} onReload={onReload} />
    </div>
  );
}

function AllowedLocations({ locations, employeeLocations, profiles, onReload }: { locations: AllowedLocation[]; employeeLocations: EmployeeLocation[]; profiles: Profile[]; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', lat: '', lng: '', radius_meters: '150' });
  const [busy, setBusy] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignSelect, setAssignSelect] = useState<Record<string, string>>({});
  const [qrLocation, setQrLocation] = useState<AllowedLocation | null>(null);

  function resetForm() {
    setForm({ name: '', address: '', lat: '', lng: '', radius_meters: '150' });
    setEditId(null);
    setShowForm(false);
    setErr(null);
  }

  async function geocode() {
    const addr = form.address.trim();
    if (!addr) { setErr('נא להזין כתובת תחילה'); return; }
    setGeocoding(true);
    setErr(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`, {
        headers: { 'Accept-Language': 'he' },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setForm((f) => ({ ...f, lat: parseFloat(data[0].lat).toFixed(6), lng: parseFloat(data[0].lon).toFixed(6) }));
      } else {
        setErr('לא נמצאו קואורדינטות לכתובת זו');
      }
    } catch {
      setErr('שגיאה בחיפוש הכתובת');
    }
    setGeocoding(false);
  }

  function startEdit(loc: AllowedLocation) {
    setEditId(loc.id);
    setShowForm(true);
    setForm({
      name: loc.name,
      address: loc.address ?? '',
      lat: String(loc.lat),
      lng: String(loc.lng),
      radius_meters: String(loc.radius_meters),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      radius_meters: parseInt(form.radius_meters) || 150,
    };
    if (!payload.name || isNaN(payload.lat) || isNaN(payload.lng)) {
      setErr('נא למלא שם וקואורדינטות תקינות');
      setBusy(false);
      return;
    }
    const { error } = editId
      ? await supabase.from('allowed_locations').update(payload).eq('id', editId)
      : await supabase.from('allowed_locations').insert(payload);
    if (error) setErr(error.message);
    else { resetForm(); onReload(); }
    setBusy(false);
  }

  async function remove(id: string) {
    await supabase.from('allowed_locations').delete().eq('id', id);
    onReload();
  }

  async function assignEmployee(locationId: string) {
    const employeeId = assignSelect[locationId];
    if (!employeeId) return;
    await supabase.from('employee_locations').insert({ location_id: locationId, employee_id: employeeId });
    setAssignSelect((s) => ({ ...s, [locationId]: '' }));
    onReload();
  }

  async function unassignEmployee(linkId: string) {
    await supabase.from('employee_locations').delete().eq('id', linkId);
    onReload();
  }

  function assignedTo(locId: string): EmployeeLocation[] {
    return employeeLocations.filter((el) => el.location_id === locId);
  }

  function unassignedProfiles(locId: string): Profile[] {
    const assignedIds = new Set(assignedTo(locId).map((el) => el.employee_id));
    return profiles.filter((p) => p.role === 'employee' && !assignedIds.has(p.id));
  }

  return (
    <Card>
      <SectionTitle title="מקומות מותרים לדיווח" icon={<MapPin className="h-5 w-5" />} action={<Badge color="blue">{locations.length} מקומות</Badge>} />
      {showForm ? (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">שם המקום</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" placeholder="משרד ראשי" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">כתובת</label>
            <div className="flex gap-2">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" placeholder="רחוב, מספר, עיר" />
              <button type="button" onClick={geocode} disabled={geocoding} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-brand-100 hover:text-brand-700 disabled:opacity-50" title="מלא קואורדינטות לפי הכתובת">
                {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                מצא נ.צ.
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">קו רוחב (Lat)</label>
            <input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" placeholder="32.0853" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">קו אורך (Lng)</label>
            <input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" placeholder="34.7818" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">רדיוס (מטרים)</label>
            <input value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">בחירה במפה</label>
            <MapPicker
              lat={form.lat ? parseFloat(form.lat) : null}
              lng={form.lng ? parseFloat(form.lng) : null}
              radius={parseInt(form.radius_meters) || 150}
              onPick={(lat, lng) => setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }))}
            />
          </div>
          {err && <p className="sm:col-span-2 text-sm text-rose-600">{err}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">{editId ? 'עדכן' : 'הוסף מקום'}</button>
            <button type="button" onClick={resetForm} className="rounded-xl bg-slate-100 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-200">ביטול</button>
          </div>
        </form>
      ) : (
        <div className="p-4">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700">
            <Plus className="h-4 w-4" /> הוסף מקום חדש
          </button>
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {locations.length === 0 && !showForm && <p className="px-5 py-10 text-center text-sm text-slate-400">אין מקומות מוגדרים</p>}
        {locations.map((l) => {
          const assigned = assignedTo(l.id);
          const unassigned = unassignedProfiles(l.id);
          const isExpanded = expandedId === l.id;
          return (
            <div key={l.id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{l.name}</p>
                  <p className="text-xs text-slate-400">{l.address || '—'}</p>
                  <p className="text-[11px] text-slate-400">נ.צ {Number(l.lat).toFixed(4)}, {Number(l.lng).toFixed(4)} · רדיוס {l.radius_meters}מ'</p>
                  {assigned.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {assigned.map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                          {a.employee?.full_name ?? '—'}
                          <button onClick={() => unassignEmployee(a.id)} className="text-brand-400 hover:text-rose-500" title="הסר">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setExpandedId(isExpanded ? null : l.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-brand-100 hover:text-brand-600" title="קשר עובדים">
                    <UserCog className="h-4 w-4" />
                  </button>
                  <button onClick={() => setQrLocation(l)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-brand-100 hover:text-brand-600" title="קוד QR">
                    <QrCode className="h-4 w-4" />
                  </button>
                  <button onClick={() => startEdit(l)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-brand-100 hover:text-brand-600" title="ערוך">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(l.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600" title="מחק">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-600">עובדים מורשים לדיווח ממקום זה</p>
                  {assigned.length === 0 && <p className="mb-2 text-xs text-slate-400">אין עובדים משויכים — כולם יכולים לדווח</p>}
                  {unassigned.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        value={assignSelect[l.id] ?? ''}
                        onChange={(e) => setAssignSelect((s) => ({ ...s, [l.id]: e.target.value }))}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500"
                      >
                        <option value="">בחר עובד...</option>
                        {unassigned.map((p) => (
                          <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                      </select>
                      <button onClick={() => assignEmployee(l.id)} disabled={!assignSelect[l.id]} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">כל העובדים כבר משויכים</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {qrLocation && (
        <QrPrintModal location={qrLocation} onClose={() => setQrLocation(null)} />
      )}
    </Card>
  );
}

function QrPrintModal({ location, onClose }: { location: AllowedLocation; onClose: () => void }) {
  const qrValue = JSON.stringify({ type: 'workplace', id: location.id, name: location.name, lat: location.lat, lng: location.lng });
  function handlePrint() {
    const svg = document.getElementById('qr-svg');
    const svgHtml = svg?.innerHTML ?? '';
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>קוד QR - ${location.name}</title>
      <style>
        body { font-family: 'Heebo', 'Arial', sans-serif; text-align: center; padding: 40px; }
        h1 { font-size: 22px; margin-bottom: 8px; }
        p { color: #555; font-size: 14px; margin: 4px 0; }
        .qr { margin: 24px 0; display: flex; justify-content: center; }
        .qr > div { padding: 16px; border: 2px solid #e2e8f0; border-radius: 16px; }
      </style></head><body>
        <h1>${location.name}</h1>
        <p>${location.address ?? ''}</p>
        <div class="qr"><div>${svgHtml}</div></div>
        <p>סרקו קוד זה בכניסה לעבודה</p>
      </body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        /* ignore */
      }
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-800">קוד QR - {location.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex justify-center py-6">
          <div id="qr-svg" className="rounded-2xl border-2 border-slate-200 p-4">
            <QRCodeSVG value={qrValue} size={200} level="M" />
          </div>
        </div>
        <p className="text-sm text-slate-500">הדפיסו את הקוד והציבו אותו במקום העבודה. העובדים יסרקו אותו עם המצלמה בעת הדיווח.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100">סגור</button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700">
            <Printer className="h-4 w-4" /> הדפס קוד
          </button>
        </div>
      </Card>
    </div>
  );
}

function AddEmployee({ departments, onReload }: { departments: { id: string; name: string }[]; onReload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const fullName = String(form.get('full_name') ?? '');
    const employeeNumber = String(form.get('employee_number') ?? '');
    const departmentId = String(form.get('department_id') ?? '') || null;
    const phone = String(form.get('phone') ?? '');

    const { error } = await createStaffUser({
      email,
      password,
      full_name: fullName,
      employee_number: employeeNumber || null,
      department_id: departmentId,
      phone: phone || null,
      role: 'employee',
    });
    if (error) {
      setMsg({ type: 'err', text: error });
      setBusy(false);
      return;
    }

    setMsg({ type: 'ok', text: 'העובד נוסף בהצלחה!' });
    setBusy(false);
    onReload();
    (e.target as HTMLFormElement).reset();
  }

  return (
    <Card>
      <SectionTitle title="הוסף עובד חדש" icon={<UserPlus className="h-5 w-5" />} />
      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <FormField label="שם מלא" name="full_name" required />
        <FormField label="אימייל" name="email" type="email" required />
        <FormField label="סיסמה ראשונית" name="password" type="password" required />
        <FormField label="מספר עובד" name="employee_number" />
        <FormField label="טלפון" name="phone" />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">מחלקה</label>
          <select name="department_id" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white">
            <option value="">— ללא —</option>
            {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
          </select>
        </div>
        <div className="sm:col-span-2">
          {msg && (
            <div className={`mb-3 rounded-xl px-4 py-2.5 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {msg.text}
            </div>
          )}
          <button type="submit" disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {busy ? 'מוסיף...' : 'הוסף עובד'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function FormField({ label, name, type = 'text', required }: { label: string; name: string; type?: string; required?: boolean }) {
  const isEmail = type === 'email';
  const ltr = isEmail || type === 'password';
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label} {required && <span className="text-rose-500">*</span>}</label>
      <input
        name={name}
        type={isEmail ? 'text' : type}
        inputMode={isEmail ? 'email' : undefined}
        autoCapitalize={isEmail ? 'none' : undefined}
        autoCorrect={isEmail ? 'off' : undefined}
        spellCheck={isEmail ? false : undefined}
        required={required}
        dir={ltr ? 'ltr' : undefined}
        autoComplete={isEmail ? 'email' : type === 'password' ? 'new-password' : undefined}
        className={`w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 ${ltr ? 'text-left' : ''}`}
      />
    </div>
  );
}

function DepartmentsPage({ departments, onReload }: { departments: Department[]; onReload: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from('departments').insert({ name: name.trim() });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    setName('');
    setBusy(false);
    onReload();
  }

  async function remove(id: string) {
    setErr(null);
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    onReload();
  }

  return (
    <Card>
      <SectionTitle title="ניהול מחלקות" icon={<Network className="h-5 w-5" />} />
      <form onSubmit={add} className="flex gap-2 p-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם מחלקה" className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white" />
        <button type="submit" disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">הוסף</button>
      </form>
      {err && <p className="px-5 pb-2 text-sm text-rose-600">{err}</p>}
      <div className="divide-y divide-slate-100">
        {departments.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">אין מחלקות עדיין</p>}
        {departments.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm font-semibold text-slate-700">{d.name}</span>
            <button onClick={() => remove(d.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600" title="מחק מחלקה">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ==================== REPORTS & OTHER PAGES ==================== */

function ExceptionsPage({ attendance, onReload }: { attendance: Attendance[]; onReload: () => void }) {
  const flagged = attendance.filter((a) => !a.clock_out || !a.location_verified);
  async function approve(id: string) {
    await supabase.from('attendance').update({ status: 'approved' }).eq('id', id);
    onReload();
  }
  return (
    <Card>
      <SectionTitle title="חריגות דיווח" icon={<AlertTriangle className="h-5 w-5" />} action={<Badge color="red">{flagged.length} חריגים</Badge>} />
      <div className="divide-y divide-slate-100">
        {flagged.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">אין חריגות</p>}
        {flagged.map((a) => {
          const issue = !a.clock_out ? 'יציאה חסרה' : 'מיקום לא מאומת';
          return (
            <div key={a.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={a.profile?.full_name ?? '?'} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{a.profile?.full_name}</p>
                  <p className="text-[11px] text-slate-400">{formatHebrewDate(a.clock_in)} · {issue}</p>
                </div>
              </div>
              <button onClick={() => approve(a.id)} className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-200">אשר דיווח</button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function EmployeeReportsPage({ attendance, profiles, onReload }: { attendance: Attendance[]; profiles: Profile[]; onReload: () => void }) {
  const [selected, setSelected] = useState<string>('');
  const [editRow, setEditRow] = useState<Attendance | null>(null);
  const [deleteRow, setDeleteRow] = useState<Attendance | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addEmp, setAddEmp] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addIn, setAddIn] = useState('08:00');
  const [addOut, setAddOut] = useState('17:00');
  const [addBusy, setAddBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const employees = profiles.filter((p) => p.role === 'employee' && p.status === 'active');
  const empAtt = attendance.filter((a) => !selected || a.user_id === selected);

  async function handleDelete(id: string) {
    const result = await managerDeleteAttendance(id);
    if (result.error) {
      setMsg({ type: 'err', text: result.error });
      setDeleteRow(null);
      return;
    }
    setMsg({ type: 'ok', text: 'הדיווח נמחק.' });
    setDeleteRow(null);
    onReload();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const userId = addEmp || selected;
    if (!userId || !addDate || !addIn) {
      setMsg({ type: 'err', text: 'נא לבחור עובד, תאריך ושעת כניסה.' });
      return;
    }
    if (addOut && addOut <= addIn) {
      setMsg({ type: 'err', text: 'שעת היציאה צריכה להיות אחרי שעת הכניסה.' });
      return;
    }
    setAddBusy(true);
    setMsg(null);
    const clockIn = new Date(`${addDate}T${addIn}:00+03:00`).toISOString();
    const clockOut = addOut ? new Date(`${addDate}T${addOut}:00+03:00`).toISOString() : null;
    const result = await managerInsertAttendance({ userId, clockIn, clockOut });
    setAddBusy(false);
    if (result.error) {
      setMsg({ type: 'err', text: result.error });
      return;
    }
    setMsg({ type: 'ok', text: 'הדיווח נוסף.' });
    setShowAdd(false);
    onReload();
  }

  return (
    <Card>
      <SectionTitle title="ניהול דיווחים לעובד" icon={<ClipboardList className="h-5 w-5" />} />
      <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
        כאן מוסיפים, מתקנים או מוחקים <span className="font-semibold text-slate-700">דיווח נוכחות</span> (כניסה/יציאה).
        המחיקה מוחקת רק את השורה הזו — העובד נשאר במערכת.
      </p>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full max-w-xs rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white">
          <option value="">כל העובדים</option>
          {employees.map((p) => (<option key={p.id} value={p.id}>{p.full_name}</option>))}
        </select>
        <button
          type="button"
          onClick={() => {
            setShowAdd((v) => !v);
            setAddEmp(selected);
            setMsg(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> הוסף דיווח
        </button>
      </div>
      {showAdd && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <select required value={addEmp} onChange={(e) => setAddEmp(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
            <option value="">בחר עובד</option>
            {employees.map((p) => (<option key={p.id} value={p.id}>{p.full_name}</option>))}
          </select>
          <input type="date" required value={addDate} onChange={(e) => setAddDate(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
          <input type="time" required dir="ltr" value={addIn} onChange={(e) => setAddIn(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
          <input type="time" dir="ltr" value={addOut} onChange={(e) => setAddOut(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
          <button type="submit" disabled={addBusy} className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60">
            {addBusy ? 'מוסיף...' : 'שמור דיווח'}
          </button>
        </form>
      )}
      {msg && (
        <p className={`px-5 py-2 text-sm font-medium ${msg.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-4 py-2.5 font-medium">עובד</th><th className="px-4 py-2.5 font-medium">תאריך</th><th className="px-4 py-2.5 font-medium">כניסה</th><th className="px-4 py-2.5 font-medium">יציאה</th><th className="px-4 py-2.5 font-medium">שעות</th><th className="px-4 py-2.5 font-medium">פעולות</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {empAtt.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">אין דיווחים</td></tr>
            )}
            {empAtt.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-semibold text-slate-700">{a.profile?.full_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatHebrewDate(a.clock_in)}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatTime(a.clock_in)}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatTime(a.clock_out) || '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{a.clock_out ? hoursBetween(a.clock_in, a.clock_out) : '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditRow(a)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-brand-100 hover:text-brand-600" title="ערוך דיווח">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteRow(a)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600" title="מחק דיווח">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editRow && (
        <EditAttendanceModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); onReload(); }}
        />
      )}

      {deleteRow && (
        <ConfirmDeleteModal
          name={`הדיווח של ${deleteRow.profile?.full_name ?? ''} מ-${formatHebrewDate(deleteRow.clock_in)}`}
          title="מחיקת דיווח נוכחות"
          confirmLabel="מחק דיווח"
          description={
            <>
              האם למחוק את דיווח הנוכחות של{' '}
              <span className="font-bold text-slate-700">{deleteRow.profile?.full_name ?? 'העובד'}</span>
              {' '}מתאריך {formatHebrewDate(deleteRow.clock_in)}
              {formatTime(deleteRow.clock_in) ? ` (${formatTime(deleteRow.clock_in)}${formatTime(deleteRow.clock_out) ? `–${formatTime(deleteRow.clock_out)}` : ''})` : ''}?
              <br />
              יימחק רק הדיווח הזה. העובד עצמו לא יימחק מהמערכת.
            </>
          }
          onCancel={() => setDeleteRow(null)}
          onConfirm={() => handleDelete(deleteRow.id)}
        />
      )}
    </Card>
  );
}

function EditAttendanceModal({ row, onClose, onSaved }: { row: Attendance; onClose: () => void; onSaved: () => void }) {
  const toLocalInput = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [clockIn, setClockIn] = useState(toLocalInput(row.clock_in));
  const [clockOut, setClockOut] = useState(toLocalInput(row.clock_out));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const payload: Record<string, unknown> = {
      clock_in: new Date(clockIn).toISOString(),
      clock_out: clockOut ? new Date(clockOut).toISOString() : null,
    };
    const { error } = await supabase.from('attendance').update(payload).eq('id', row.id);
    if (error) { setErr(error.message); setBusy(false); return; }
    onSaved();
    setBusy(false);
  }

  return (
    <Modal title="עריכת דיווח" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">שעת כניסה</label>
          <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">שעת יציאה</label>
          <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" />
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100">ביטול</button>
          <button onClick={save} disabled={busy || !clockIn} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">
            <Save className="h-4 w-4" /> שמור
          </button>
        </div>
      </div>
    </Modal>
  );
}




function SpecialReportsPage({ attendance, profiles }: { attendance: Attendance[]; profiles: Profile[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayAtt = attendance.filter((a) => a.clock_in && new Date(a.clock_in) >= today);
  return (
    <Card>
      <SectionTitle title="דיווחים מיוחדים" icon={<FileText className="h-5 w-5" />} />
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
        <StatBox label="דיווחים היום" value={todayAtt.length} color="brand" />
        <StatBox label="עובדים פעילים" value={profiles.filter((p) => p.role === 'employee' && p.status === 'active').length} color="emerald" />
        <StatBox label="דיווחים ללא יציאה" value={attendance.filter((a) => !a.clock_out).length} color="rose" />
      </div>
      <div className="px-5 pb-5">
        <p className="text-sm text-slate-500">כאן ניתן יהיה ליצור דיווחים מיוחדים עבור עובדים — ימי מחלה, חופשה, שעות נוספות ועוד. הדיווחים יופיעו בדוחות החודשיים.</p>
      </div>
    </Card>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = { brand: 'bg-brand-50 text-brand-700', emerald: 'bg-emerald-50 text-emerald-700', rose: 'bg-rose-50 text-rose-700' };
  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

function RoleProjectPage({ shifts, profiles }: { shifts: Shift[]; profiles: Profile[] }) {
  const roles = new Map<string, Shift[]>();
  shifts.forEach((s) => { const k = s.role_project ?? 'כללי'; if (!roles.has(k)) roles.set(k, []); roles.get(k)!.push(s); });
  return (
    <Card>
      <SectionTitle title="תפקיד / פרויקט" icon={<Briefcase className="h-5 w-5" />} />
      <div className="divide-y divide-slate-100">
        {Array.from(roles.entries()).map(([role, ss]) => (
          <div key={role} className="px-5 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">{role}</p>
              <Badge color="blue">{ss.length} משמרות</Badge>
            </div>
            <div className="mt-2 space-y-1">
              {ss.map((s) => (
                <p key={s.id} className="text-xs text-slate-500">{s.profile?.full_name} · {formatHebrewDate(s.start_time)}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReportRemindersPage({ reminders, onReload }: { reminders: Reminder[]; onReload: () => void }) {
  return <ManagerRemindersFullPage reminders={reminders} onReload={onReload} />;
}

function QuickStickersPage() {
  const [stickers, setStickers] = useState<QuickSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('brand');
  const [editing, setEditing] = useState<QuickSticker | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from('quick_stickers')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setStickers((data as QuickSticker[]) ?? []);
        setLoading(false);
      });
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    const { data } = await supabase
      .from('quick_stickers')
      .insert({ label: newLabel.trim(), color: newColor, sort_order: stickers.length })
      .select()
      .single();
    if (data) setStickers([...stickers, data as QuickSticker]);
    setNewLabel('');
    setBusy(false);
  }

  async function update(id: string, patch: Partial<QuickSticker>) {
    setBusy(true);
    await supabase.from('quick_stickers').update(patch).eq('id', id);
    setStickers(stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setEditing(null);
    setBusy(false);
  }

  async function remove(id: string) {
    await supabase.from('quick_stickers').delete().eq('id', id);
    setStickers(stickers.filter((s) => s.id !== id));
  }

  const colorClasses: Record<string, string> = {
    brand: 'bg-brand-100 text-brand-700 border-brand-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <>
      <Card>
        <SectionTitle title="מדבקות דיווח מהיר" icon={<FileText className="h-5 w-5" />} action={<Badge color="blue">{stickers.length} מדבקות</Badge>} />
        <p className="px-5 pt-4 text-sm text-slate-500">מדבקות אלו מאפשרות לעובדים דיווח מהיר בלחיצה אחת מהאפליקציה הניידת. צרו מדבקות עבור מיקומים נפוצים, סוגי דיווח ועוד.</p>

        <form onSubmit={add} className="flex flex-wrap items-center gap-2 p-5">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="טקסט המדבקה (לדוגמה: משרד ראשי)"
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white"
          />
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white"
          >
            <option value="brand">כחול</option>
            <option value="emerald">ירוק</option>
            <option value="amber">כתום</option>
            <option value="rose">אדום</option>
            <option value="blue">תכלת</option>
            <option value="slate">אפור</option>
          </select>
          <button type="submit" disabled={busy || !newLabel.trim()} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">
            <Plus className="h-4 w-4" />
            הוסף מדבקה
          </button>
        </form>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">טוען...</p>
        ) : stickers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">אין מדבקות עדיין. הוסיפו מדבקה ראשונה למעלה.</p>
        ) : (
          <div className="flex flex-wrap gap-3 px-5 pb-5">
            {stickers.map((s) => (
              <div key={s.id} className={`group flex items-center gap-2 rounded-full border px-4 py-2 ${colorClasses[s.color ?? 'brand'] ?? colorClasses.brand}`}>
                <span className="text-sm font-medium">{s.label}</span>
                <button
                  onClick={() => setEditing(s)}
                  className="opacity-0 transition group-hover:opacity-100"
                  title="ערוך"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="opacity-0 transition group-hover:opacity-100"
                  title="מחק"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <EditStickerModal
          sticker={editing}
          colorClasses={colorClasses}
          onClose={() => setEditing(null)}
          onSave={(label, color) => update(editing.id, { label, color })}
        />
      )}
    </>
  );
}

function EditStickerModal({
  sticker,
  colorClasses,
  onClose,
  onSave,
}: {
  sticker: QuickSticker;
  colorClasses: Record<string, string>;
  onClose: () => void;
  onSave: (label: string, color: string) => void;
}) {
  const [label, setLabel] = useState(sticker.label);
  const [color, setColor] = useState(sticker.color ?? 'brand');

  return (
    <Modal title="עריכת מדבקה" onClose={onClose}>
      <div className="space-y-4">
        <ModalField label="טקסט המדבקה" value={label} onChange={setLabel} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">צבע</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(colorClasses).map(([key, cls]) => (
              <button
                key={key}
                onClick={() => setColor(key)}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-medium ${cls} ${color === key ? 'ring-2 ring-slate-400 ring-offset-1' : ''}`}
              >
                {key === 'brand' ? 'כחול' : key === 'emerald' ? 'ירוק' : key === 'amber' ? 'כתום' : key === 'rose' ? 'אדום' : key === 'blue' ? 'תכלת' : 'אפור'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100">ביטול</button>
          <button
            onClick={() => onSave(label, color)}
            disabled={!label.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            שמור
          </button>
        </div>
      </div>
    </Modal>
  );
}

function GpsRoutesPage({ attendance }: { attendance: Attendance[] }) {
  const withGps = attendance.filter((a) => a.lat != null && a.lng != null);
  return (
    <Card>
      <SectionTitle title="מסלולי מיקום GPS" icon={<MapPin className="h-5 w-5" />} />
      <div className="divide-y divide-slate-100">
        {withGps.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">{a.profile?.full_name ?? '—'}</p>
              <p className="text-[11px] text-slate-400">{formatHebrewDate(a.clock_in)} · נ.צ {Number(a.lat).toFixed(4)}, {Number(a.lng).toFixed(4)}</p>
            </div>
            <Badge color={a.location_verified ? 'green' : 'red'}>{a.location_verified ? 'מאומת' : 'לא מאומת'}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProfileFieldsPage({ fields, onReload }: { fields: ProfileField[]; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', key: '', type: 'text' as ProfileField['type'], options: '', required: false, active: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function resetForm() {
    setForm({ label: '', key: '', type: 'text', options: '', required: false, active: true });
    setEditId(null);
    setShowForm(false);
    setErr(null);
  }

  function startEdit(f: ProfileField) {
    setEditId(f.id);
    setShowForm(true);
    setForm({ label: f.label, key: f.key, type: f.type, options: f.options ?? '', required: f.required, active: f.active });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const key = form.key.trim() || form.label.trim().toLowerCase().replace(/\s+/g, '_');
    const payload = {
      label: form.label.trim(),
      key,
      type: form.type,
      options: form.options.trim() || null,
      required: form.required,
      active: form.active,
      sort_order: fields.length,
    };
    if (!payload.label) {
      setErr('נא למלא שם שדה');
      setBusy(false);
      return;
    }
    const { error } = editId
      ? await supabase.from('profile_fields').update(payload).eq('id', editId)
      : await supabase.from('profile_fields').insert(payload);
    if (error) setErr(error.message);
    else { resetForm(); onReload(); }
    setBusy(false);
  }

  async function remove(id: string) {
    await supabase.from('profile_fields').delete().eq('id', id);
    onReload();
  }

  async function toggleActive(f: ProfileField) {
    await supabase.from('profile_fields').update({ active: !f.active }).eq('id', f.id);
    onReload();
  }

  const typeLabels: Record<string, string> = { text: 'טקסט', number: 'מספר', date: 'תאריך', phone: 'טלפון', email: 'אימייל', select: 'בחירה' };

  return (
    <Card>
      <SectionTitle title="ניהול שדות פרופיל עובד" icon={<UserPlus className="h-5 w-5" />} action={<Badge color="blue">{fields.length} שדות</Badge>} />
      {showForm ? (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">שם השדה</label>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" placeholder="שם מלא" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">מפתח (אוטומטי אם ריק)</label>
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" placeholder="full_name" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">סוג שדה</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ProfileField['type'] })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white">
              {Object.entries(typeLabels).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
            </select>
          </div>
          {form.type === 'select' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">אפשרויות (מופרדות בפסיק)</label>
              <input value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" placeholder="אפשרות 1, אפשרות 2" />
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              שדה חובה
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              פעיל
            </label>
          </div>
          {err && <p className="sm:col-span-2 text-sm text-rose-600">{err}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">{editId ? 'עדכן' : 'הוסף שדה'}</button>
            <button type="button" onClick={resetForm} className="rounded-xl bg-slate-100 px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-200">ביטול</button>
          </div>
        </form>
      ) : (
        <div className="p-4">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700">
            <Plus className="h-4 w-4" /> הוסף שדה חדש
          </button>
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {fields.length === 0 && !showForm && <p className="px-5 py-10 text-center text-sm text-slate-400">אין שדות מוגדרים</p>}
        {fields.map((f) => (
          <div key={f.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">{f.label}</span>
              <Badge color="slate">{typeLabels[f.type]}</Badge>
              {f.required && <Badge color="amber">חובה</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleActive(f)} className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${f.active ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`} title={f.active ? 'כבה' : 'הפעל'}>
                {f.active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </button>
              <button onClick={() => startEdit(f)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-brand-100 hover:text-brand-600" title="ערוך">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => remove(f.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600" title="מחק">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ManagerRemindersFullPage({ reminders, onReload }: { reminders: Reminder[]; onReload: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  async function add() {
    if (!title.trim() || !profile) return;
    await supabase.from('reminders').insert({ user_id: profile.id, title: title.trim(), due_date: new Date().toISOString().slice(0, 10), done: false });
    setTitle('');
    onReload();
  }
  async function toggle(id: string, done: boolean) { await supabase.from('reminders').update({ done: !done }).eq('id', id); onReload(); }
  async function remove(id: string) { await supabase.from('reminders').delete().eq('id', id); onReload(); }
  return (
    <Card>
      <SectionTitle title="תזכורות למנהל" icon={<Bell className="h-5 w-5" />} />
      <div className="flex gap-2 p-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="תזכורת חדשה..." className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none focus:border-brand-500 focus:bg-white" />
        <button onClick={add} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"><Plus className="h-4 w-4" />הוסף</button>
      </div>
      <div className="divide-y divide-slate-100">
        {reminders.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-5 py-3">
            <button onClick={() => toggle(r.id, r.done)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${r.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-brand-400'}`}>
              {r.done && <CheckSquare className="h-3 w-3" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${r.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{r.title}</p>
              {r.due_date && <p className="text-[11px] text-slate-400">{formatHebrewDate(r.due_date)}</p>}
            </div>
            <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RestoreEmployeesPage({ profiles, onReload }: { profiles: Profile[]; onReload: () => void }) {
  const deleted = profiles.filter((p) => p.status === 'deleted' && !isHiddenDeveloperProfile(p));
  async function restore(id: string) { await supabase.from('profiles').update({ status: 'active' }).eq('id', id); onReload(); }
  return (
    <Card>
      <SectionTitle title="שחזור עובדים שנמחקו" icon={<UserPlus className="h-5 w-5" />} />
      <div className="divide-y divide-slate-100">
        {deleted.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">אין עובדים מחוקים</p>}
        {deleted.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={p.full_name} size="sm" />
              <div>
                <p className="text-sm font-semibold text-slate-700">{p.full_name}</p>
                <p className="text-[11px] text-slate-400">
                  {p.role === 'manager' ? 'מנהל' : p.employee_number ?? '—'}
                </p>
              </div>
            </div>
            <button onClick={() => restore(p.id)} className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200">שחזר</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NoReportsPage({ attendance, profiles }: { attendance: Attendance[]; profiles: Profile[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const reportedIds = new Set(attendance.filter((a) => a.clock_in && new Date(a.clock_in) >= today).map((a) => a.user_id));
  const noReport = profiles.filter((p) => p.role === 'employee' && p.status === 'active' && !reportedIds.has(p.id));
  return (
    <Card>
      <SectionTitle title="עובדים ללא דיווחים היום" icon={<AlertTriangle className="h-5 w-5" />} action={<Badge color="red">{noReport.length} עובדים</Badge>} />
      <div className="divide-y divide-slate-100">
        {noReport.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">כל העובדים דיווחו היום</p>}
        {noReport.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={p.full_name} size="sm" />
              <p className="text-sm font-semibold text-slate-700">{p.full_name}</p>
            </div>
            <Badge color="amber">לא דיווח</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MonthlySummaryPage({ attendance, profiles }: { attendance: Attendance[]; profiles: Profile[] }) {
  const now = new Date();
  const monthAtt = attendance.filter((a) => a.clock_in && new Date(a.clock_in).getMonth() === now.getMonth());
  return (
    <Card>
      <SectionTitle title="דוח חודשי ללא פירוט" icon={<FileText className="h-5 w-5" />} />
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2.5 font-medium">עובד</th><th className="px-4 py-2.5 font-medium">סה"כ דיווחים</th><th className="px-4 py-2.5 font-medium">מאושרים</th><th className="px-4 py-2.5 font-medium">ממתינים</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {profiles.filter((p) => p.role === 'employee').map((p) => {
              const empAtt = monthAtt.filter((a) => a.user_id === p.id);
              return (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-semibold text-slate-700">{p.full_name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{empAtt.length}</td>
                  <td className="px-4 py-2.5 text-emerald-600 font-medium">{empAtt.filter((a) => a.status === 'approved').length}</td>
                  <td className="px-4 py-2.5 text-amber-600 font-medium">{empAtt.filter((a) => a.status === 'pending').length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MonthlyDetailPage({ attendance, requests }: { attendance: Attendance[]; requests: EmployeeRequest[] }) {
  return (
    <Card>
      <SectionTitle title="דוח חודשי עם פירוט" icon={<FileText className="h-5 w-5" />} />
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2.5 font-medium">עובד</th><th className="px-4 py-2.5 font-medium">תאריך</th><th className="px-4 py-2.5 font-medium">כניסה</th><th className="px-4 py-2.5 font-medium">יציאה</th><th className="px-4 py-2.5 font-medium">שעות</th><th className="px-4 py-2.5 font-medium">בקשת שינוי</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {attendance.map((a) => {
              const dayReqs = requestsForAttendanceDay(a.user_id, a.clock_in, requests);
              return (
              <tr key={a.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-semibold text-slate-700">{a.profile?.full_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatHebrewDate(a.clock_in)}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatTime(a.clock_in)}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatTime(a.clock_out) || '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{a.clock_out ? hoursBetween(a.clock_in, a.clock_out) : '—'}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">{dayReqs.length ? formatChangeRequestsPlain(dayReqs) : ''}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CompareShiftsPage({ shifts, attendance, profiles }: { shifts: Shift[]; attendance: Attendance[]; profiles: Profile[] }) {
  return (
    <Card>
      <SectionTitle title="השוואת סידור עבודה לנוכחות" icon={<FileText className="h-5 w-5" />} />
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2.5 font-medium">עובד</th><th className="px-4 py-2.5 font-medium">משמרת מתוכננת</th><th className="px-4 py-2.5 font-medium">כניסה בפועל</th><th className="px-4 py-2.5 font-medium">התאמה</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {shifts.map((s) => {
              const att = attendance.find((a) => a.user_id === s.user_id && a.clock_in && new Date(a.clock_in).toDateString() === new Date(s.start_time).toDateString());
              const match = att && att.clock_in;
              return (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-semibold text-slate-700">{s.profile?.full_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatTime(s.start_time)} - {formatTime(s.end_time)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{att ? formatTime(att.clock_in) : '—'}</td>
                  <td className="px-4 py-2.5"><Badge color={match ? 'green' : 'red'}>{match ? 'תואם' : 'חוסר'}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DailyAttendancePage({ attendance }: { attendance: Attendance[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayAtt = attendance.filter((a) => a.clock_in && new Date(a.clock_in) >= today);
  return (
    <Card>
      <SectionTitle title="דוח נוכחות יומי" icon={<FileText className="h-5 w-5" />} action={<Badge color="blue">{todayAtt.length} דיווחים</Badge>} />
      <div className="divide-y divide-slate-100">
        {todayAtt.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={a.profile?.full_name ?? '?'} size="sm" />
              <div>
                <p className="text-sm font-semibold text-slate-700">{a.profile?.full_name}</p>
                <p className="text-[11px] text-slate-400">{formatTime(a.clock_in)} → {formatTime(a.clock_out) || '...'}</p>
              </div>
            </div>
            <Badge color={a.clock_in && !a.clock_out ? 'green' : 'slate'}>{a.clock_in && !a.clock_out ? 'נוכח' : 'יצא'}</Badge>
          </div>
        ))}
        {todayAtt.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">אין דיווחים היום</p>}
      </div>
    </Card>
  );
}

function SummaryExportPage({ attendance, profiles, expenses }: { attendance: Attendance[]; profiles: Profile[]; expenses: Expense[] }) {
  return (
    <Card>
      <SectionTitle title="דוח מסכם וייצוא לשכר" icon={<FileText className="h-5 w-5" />} />
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2.5 font-medium">עובד</th><th className="px-4 py-2.5 font-medium">דיווחים</th><th className="px-4 py-2.5 font-medium">הוצאות/תוספות</th><th className="px-4 py-2.5 font-medium">סה"כ ₪</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {profiles.filter((p) => p.role === 'employee').map((p) => {
              const empExp = expenses.filter((e) => e.user_id === p.id).reduce((sum, e) => sum + e.amount, 0);
              const empAtt = attendance.filter((a) => a.user_id === p.id).length;
              return (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-semibold text-slate-700">{p.full_name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{empAtt}</td>
                  <td className={`px-4 py-2.5 font-medium ${empExp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{empExp.toLocaleString('he-IL')} ₪</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700">{empExp.toLocaleString('he-IL')} ₪</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AbsencesPage({ attendance, profiles }: { attendance: Attendance[]; profiles: Profile[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const presentIds = new Set(attendance.filter((a) => a.clock_in && new Date(a.clock_in) >= today).map((a) => a.user_id));
  const absent = profiles.filter((p) => p.role === 'employee' && p.status === 'active' && !presentIds.has(p.id));
  return (
    <Card>
      <SectionTitle title="דוח העדרויות ואמצעי חתימה" icon={<FileText className="h-5 w-5" />} action={<Badge color="red">{absent.length} נעדרים</Badge>} />
      <div className="divide-y divide-slate-100">
        {absent.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={p.full_name} size="sm" />
              <p className="text-sm font-semibold text-slate-700">{p.full_name}</p>
            </div>
            <Badge color="red">נעדר</Badge>
          </div>
        ))}
        {absent.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">אין העדרויות היום</p>}
      </div>
    </Card>
  );
}

function ByProjectPage({ shifts, attendance }: { shifts: Shift[]; attendance: Attendance[] }) {
  const groups = new Map<string, Shift[]>();
  shifts.forEach((s) => { const k = s.role_project ?? 'כללי'; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(s); });
  return (
    <Card>
      <SectionTitle title="דוח לפי תפקיד/פרויקט" icon={<Briefcase className="h-5 w-5" />} />
      <div className="divide-y divide-slate-100">
        {Array.from(groups.entries()).map(([role, ss]) => (
          <div key={role} className="px-5 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">{role}</p>
              <Badge color="blue">{ss.length} משמרות</Badge>
            </div>
            <div className="mt-2 space-y-1">
              {ss.map((s) => (<p key={s.id} className="text-xs text-slate-500">{s.profile?.full_name} · {formatHebrewDate(s.start_time)} · {formatTime(s.start_time)}–{formatTime(s.end_time)}</p>))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ByShiftPage({ shifts }: { shifts: Shift[] }) {
  return (
    <Card>
      <SectionTitle title="דוח לפי משמרות" icon={<Clock className="h-5 w-5" />} />
      <div className="divide-y divide-slate-100">
        {shifts.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">{s.profile?.full_name ?? '—'}</p>
              <p className="text-[11px] text-slate-400">{formatHebrewDate(s.start_time)} · {formatTime(s.start_time)}–{formatTime(s.end_time)}</p>
            </div>
            <Badge color={s.status === 'scheduled' ? 'blue' : s.status === 'completed' ? 'green' : 'red'}>{s.status === 'scheduled' ? 'מתוכנן' : s.status === 'completed' ? 'הושלם' : 'בוטל'}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LateReportPage({ attendance, profiles }: { attendance: Attendance[]; profiles: Profile[] }) {
  const late = attendance.filter((a) => a.clock_in && new Date(a.clock_in).getHours() >= 10);
  return (
    <Card>
      <SectionTitle title="דוח איחורים" icon={<Clock className="h-5 w-5" />} action={<Badge color="amber">{late.length} איחורים</Badge>} />
      <div className="divide-y divide-slate-100">
        {late.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">אין איחורים</p>}
        {late.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={a.profile?.full_name ?? '?'} size="sm" />
              <div>
                <p className="text-sm font-semibold text-slate-700">{a.profile?.full_name}</p>
                <p className="text-[11px] text-slate-400">{formatHebrewDate(a.clock_in)} · כניסה: {formatTime(a.clock_in)}</p>
              </div>
            </div>
            <Badge color="amber">איחור</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DailyDetailPage({ attendance, requests }: { attendance: Attendance[]; requests: EmployeeRequest[] }) {
  return <MonthlyDetailPage attendance={attendance} requests={requests} />;
}

function SignReportsPage({ attendance, onReload }: { attendance: Attendance[]; onReload: () => void }) {
  const flagged = attendance.filter((a) => !a.clock_out || !a.location_verified);
  async function sign(id: string) { await supabase.from('attendance').update({ status: 'approved' }).eq('id', id); onReload(); }
  return (
    <Card>
      <SectionTitle title="דוחות נוכחות" icon={<FileText className="h-5 w-5" />} action={<Badge color="green">אישור אוטומטי פעיל</Badge>} />
      <div className="px-5 py-4">
        <p className="text-sm text-slate-500">דיווחי כניסה ויציאה מאושרים אוטומטית — אין צורך באישור ידני. בקשות מיוחדות (חופשה, מחלה וכו') עדיין דורשות אישור מנהל.</p>
      </div>
      {flagged.length > 0 && (
        <>
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-sm font-bold text-slate-700">דיווחים חריגים לבדיקה</p>
            <p className="text-xs text-slate-400">דיווחים עם יציאה חסרה או מיקום לא מאומת</p>
          </div>
          <div className="divide-y divide-slate-100">
            {flagged.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{a.profile?.full_name ?? '—'}</p>
                  <p className="text-[11px] text-slate-400">{formatHebrewDate(a.clock_in)} · {formatTime(a.clock_in)} → {formatTime(a.clock_out) || '...'} · {!a.clock_out ? 'יציאה חסרה' : 'מיקום לא מאומת'}</p>
                </div>
                <button onClick={() => sign(a.id)} className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-200">אשר דיווח</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

const SETTINGS_KEY = 'bezman_global_settings';

interface AppSettings {
  alertMissingClockOut: boolean;
  allowManualReport: boolean;
  requireLocationVerification: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  alertMissingClockOut: true,
  allowManualReport: true,
  requireLocationVerification: true,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function AddManagerForm({
  profiles,
  onReload,
}: {
  profiles: Profile[];
  onReload: () => void;
}) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>(() => loadManagerPasswords());
  const [emails, setEmails] = useState<Record<string, string>>(() => loadManagerEmails());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const managers = profiles.filter(
    (p) => p.status === 'active' && p.role === 'manager' && !isHiddenDeveloperProfile(p),
  );

  useEffect(() => {
    const storedPw = loadManagerPasswords();
    const storedEmail = loadManagerEmails();
    setPasswords((prev) => {
      const next = { ...storedPw };
      for (const m of profiles) {
        if (m.login_password) next[m.id] = m.login_password;
      }
      return { ...next, ...prev };
    });
    setEmails((prev) => {
      const next = { ...storedEmail };
      for (const m of profiles) {
        if (m.login_email) next[m.id] = m.login_email;
        else if (m.employee_number?.includes('@')) next[m.id] = m.employee_number;
      }
      if (session?.user?.id && session.user.email) {
        next[session.user.id] = session.user.email;
      }
      return { ...next, ...prev };
    });
    void loadManagerEmailsFromServer().then((fromServer) => {
      if (!Object.keys(fromServer).length) return;
      setEmails((prev) => ({ ...prev, ...fromServer }));
      for (const [id, email] of Object.entries(fromServer)) {
        rememberManagerEmail(id, email);
        void supabase.from('profiles').update({ employee_number: email }).eq('id', id).eq('role', 'manager');
      }
    });
  }, [profiles, session?.user?.email, session?.user?.id]);

  function emailOf(m: Profile) {
    if (session?.user?.id === m.id && session.user.email) return session.user.email;
    return emails[m.id] || m.login_email || (m.employee_number?.includes('@') ? m.employee_number : '') || '';
  }

  function passwordOf(id: string, fallback?: string | null) {
    return passwords[id] ?? fallback ?? '';
  }

  async function savePassword(m: Profile) {
    const next = passwordOf(m.id, m.login_password).trim();
    if (next.length < 6) {
      setMsg({ type: 'err', text: 'הסיסמה חייבת להכיל לפחות 6 תווים.' });
      return;
    }
    setSavingId(m.id);
    setMsg(null);
    const { error } = await updateUserAuth({ userId: m.id, password: next });
    if (error) {
      setSavingId(null);
      setMsg({ type: 'err', text: error });
      return;
    }
    await saveManagerLoginPassword(m.id, next);
    setPasswords((prev) => ({ ...prev, [m.id]: next }));
    setSavingId(null);
    setMsg({ type: 'ok', text: `הסיסמה של ${m.full_name} נשמרה.` });
  }

  async function copyPassword(id: string, value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function deleteManager(p: Profile) {
    if (isHiddenDeveloperProfile(p)) {
      setMsg({ type: 'err', text: 'לא ניתן למחוק את החשבון הזה.' });
      setConfirmDelete(null);
      return;
    }
    if (session?.user?.id === p.id) {
      setMsg({ type: 'err', text: 'לא ניתן למחוק את המנהל שמחובר עכשיו.' });
      setConfirmDelete(null);
      return;
    }
    const { error } = await supabase.from('profiles').update({ status: 'deleted' }).eq('id', p.id).eq('role', 'manager');
    setConfirmDelete(null);
    if (error) {
      setMsg({ type: 'err', text: error.message });
      return;
    }
    setMsg({ type: 'ok', text: 'המנהל נמחק. אפשר לשחזר אותו משחזור עובדים שנמחקו.' });
    onReload();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const fullName = String(data.get('full_name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm_password') ?? '');
    const phone = String(data.get('phone') ?? '').trim();

    if (!fullName || !email || !password) {
      setMsg({ type: 'err', text: 'נא למלא שם, אימייל וסיסמה.' });
      setBusy(false);
      return;
    }
    if (password.length < 6) {
      setMsg({ type: 'err', text: 'הסיסמה חייבת להכיל לפחות 6 תווים.' });
      setBusy(false);
      return;
    }
    if (password !== confirm) {
      setMsg({ type: 'err', text: 'הסיסמאות אינן תואמות.' });
      setBusy(false);
      return;
    }

    const { error, id } = await createStaffUser({
      email,
      password,
      full_name: fullName,
      phone: phone || null,
      role: 'manager',
    });
    if (error) {
      setMsg({ type: 'err', text: error });
      setBusy(false);
      return;
    }

    if (id) {
      await supabase.from('profiles').update({ role: 'manager', hidden: false }).eq('id', id);
      await saveManagerLoginPassword(id, password);
      await saveManagerLoginEmail(id, email);
      setPasswords((prev) => ({ ...prev, [id]: password }));
      setEmails((prev) => ({ ...prev, [id]: email.trim().toLowerCase() }));
    }

    setMsg({ type: 'ok', text: 'המנהל נוסף. אפשר להתנתק ולהתחבר עם האימייל והסיסמה האלה.' });
    setBusy(false);
    form.reset();
    onReload();
  }

  return (
    <Card>
      <SectionTitle title="הוסף מנהל למערכת" icon={<UserPlus className="h-5 w-5" />} />
      <form onSubmit={submit} noValidate className="space-y-4 p-5">
        <p className="text-sm text-slate-600">
          הוסף מנהל רגיל למערכת. אחרי ההוספה אפשר להתחבר איתו ולנהל עובדים, דיווחים ובקשות.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="שם מלא" name="full_name" required />
          <FormField label="אימייל" name="email" type="email" required />
          <FormField label="סיסמה" name="password" type="password" required />
          <FormField label="אימות סיסמה" name="confirm_password" type="password" required />
          <FormField label="טלפון (אופציונלי)" name="phone" />
        </div>
        {msg && (
          <div className={`rounded-xl px-4 py-2.5 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {msg.text}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'מוסיף...' : 'הוסף מנהל למערכת'}
        </button>
      </form>
      {managers.length > 0 && (
        <div className="border-t border-slate-100 p-5 pt-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">מנהלים במערכת</p>
          <ul className="space-y-2">
            {managers.map((m) => {
              const pw = passwordOf(m.id, m.login_password);
              return (
              <li key={m.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{m.full_name}</p>
                    <p className="truncate text-left text-xs text-slate-500" dir="ltr">{emailOf(m) || 'אין אימייל שמור'}</p>
                    {m.phone && <p className="text-xs text-slate-400">{m.phone}</p>}
                    {session?.user?.id === m.id && <p className="text-[11px] text-slate-400">מחובר כרגע</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(m)}
                    disabled={session?.user?.id === m.id}
                    className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                    title="מחק מנהל"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">סיסמה</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={pw}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void savePassword(m);
                        }
                      }}
                      placeholder="אין סיסמה שמורה — הזן ושמור"
                      className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left font-mono text-sm text-slate-800 outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => copyPassword(m.id, pw)}
                      disabled={!pw}
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      title="העתק סיסמה"
                    >
                      {copiedId === m.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => savePassword(m)}
                      disabled={savingId === m.id}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-60"
                    >
                      {savingId === m.id ? 'שומר...' : 'שמור סיסמה'}
                    </button>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}
      {confirmDelete && (
        <ConfirmDeleteModal
          name={confirmDelete.full_name}
          title="מחיקת מנהל"
          confirmLabel="מחק מנהל"
          description={
            <>
              האם אתה בטוח שברצונך למחוק את המנהל <span className="font-bold text-slate-700">{confirmDelete.full_name}</span>?
              הוא לא יוכל להתחבר יותר. אפשר לשחזר אותו אחר כך משחזור עובדים שנמחקו.
            </>
          }
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteManager(confirmDelete)}
        />
      )}
    </Card>
  );
}

function GlobalSettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle title="הגדרות מערכת" icon={<Settings className="h-5 w-5" />} />
        <div className="divide-y divide-slate-100">
          {([
            { key: 'alertMissingClockOut', label: 'התראה על יציאה חסרה מיום קודם', desc: 'הצג התראה בלוח הבקרה כשלעובד חסרה יציאה מיום קודם' },
            { key: 'allowManualReport', label: 'אפשר דיווח ידני לעובדים', desc: 'עובדים יוכלו לדווח נוכחות ידנית דרך האפליקציה' },
            { key: 'requireLocationVerification', label: 'חייב אימות מיקום', desc: 'כניסה ויציאה חייבות להתבצע מתוך מיקום מאושר' },
          ] as { key: keyof AppSettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <button
                onClick={() => update(key, !settings[key])}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  settings[key] ? 'bg-brand-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
                    settings[key] ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
        >
          <Save className="h-4 w-4" />
          שמור הגדרות
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
            <Check className="h-4 w-4" />
            ההגדרות נשמרו
          </span>
        )}
      </div>
    </div>
  );
}

function AccountSettingsPage() {
  const { session, profile, signOut, reloadProfile } = useAuth();
  const locked = isDeveloperSession(session?.user?.email, session?.user?.id);
  const [displayName, setDisplayName] = useState(profile?.full_name ?? '');
  const [nameMsg, setNameMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    setNameMsg(null);
    if (!profile?.id) return;
    if (!displayName.trim()) {
      setNameMsg({ type: 'err', text: 'נא להזין שם' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ full_name: displayName.trim() }).eq('id', profile.id);
    setBusy(false);
    if (error) {
      setNameMsg({ type: 'err', text: error.message });
      return;
    }
    await reloadProfile();
    setNameMsg({ type: 'ok', text: 'השם עודכן' });
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    if (locked) {
      setEmailMsg({ type: 'err', text: 'לא ניתן לשנות את חשבון המפתחים.' });
      return;
    }
    if (!newEmail.trim()) {
      setEmailMsg({ type: 'err', text: 'נא להזין אימייל חדש' });
      return;
    }
    if (!session?.user?.id) {
      setEmailMsg({ type: 'err', text: 'לא נמצא משתמש מחובר.' });
      return;
    }
    setBusy(true);
    const { error, applied } = await updateUserAuth({ userId: session.user.id, email: newEmail.trim() });
    setBusy(false);
    if (error) {
      setEmailMsg({ type: 'err', text: error });
      return;
    }
    if (!applied) {
      setEmailMsg({ type: 'err', text: 'האימייל לא הוחל מיד. נסה שוב.' });
      return;
    }
    setEmailMsg({ type: 'ok', text: 'האימייל עודכן מיד, בלי מייל אישור. התחבר מחדש עם האימייל החדש.' });
    setNewEmail('');
    setTimeout(() => signOut(), 2500);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (locked) {
      setPwMsg({ type: 'err', text: 'לא ניתן לשנות את חשבון המפתחים.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: 'err', text: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'err', text: 'הסיסמאות אינן תואמות' });
      return;
    }
    if (!session?.user?.id) {
      setPwMsg({ type: 'err', text: 'לא נמצא משתמש מחובר.' });
      return;
    }
    setBusy(true);
    const { error } = await updateUserAuth({ userId: session.user.id, password: newPassword });
    setBusy(false);
    if (error) {
      setPwMsg({ type: 'err', text: error });
      return;
    }
    setPwMsg({ type: 'ok', text: 'הסיסמה עודכנה. אפשר להתחבר איתה מיד.' });
    setNewPassword('');
    setConfirmPassword('');
  }

  if (locked) {
    return (
      <Card>
        <SectionTitle title="חשבון מפתחים" icon={<UserCog className="h-5 w-5" />} />
        <div className="space-y-3 p-5 text-sm text-slate-600">
          <p>זהו חשבון מפתחים קבוע. הוא לא מופיע באתר, ואי אפשר לשנות את האימייל או הסיסמה שלו.</p>
          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <span className="text-slate-500">אימייל קבוע: </span>
            <span className="font-semibold text-slate-800">{session?.user?.email}</span>
          </div>
          <p>כדי להוסיף מנהל, עבור בתפריט אל הגדרות גלובליות → הוסף מנהל למערכת.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle title="פרטי חשבון" icon={<UserCog className="h-5 w-5" />} />
        <form onSubmit={handleNameSave} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">שם המנהל</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
            <span className="text-sm text-slate-500">אימייל נוכחי</span>
            <span className="text-sm font-semibold text-slate-800">{session?.user?.email ?? '—'}</span>
          </div>
          {nameMsg && (
            <div className={`rounded-xl px-4 py-2.5 text-sm ${nameMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {nameMsg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'שומר...' : 'שמור שם'}
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle title="שינוי אימייל" icon={<Mail className="h-5 w-5" />} />
        <form onSubmit={handleEmailChange} className="space-y-4 p-5">
          <p className="text-xs text-slate-400">האימייל מתעדכן מיד, בלי מייל אישור ובלי קישור.</p>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">אימייל חדש</label>
            <input
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="manager@example.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-left text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {emailMsg && (
            <div className={`rounded-xl px-4 py-2.5 text-sm ${emailMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {emailMsg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'מעדכן...' : 'עדכן אימייל'}
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle title="שינוי סיסמה" icon={<Lock className="h-5 w-5" />} />
        <form onSubmit={handlePasswordChange} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">סיסמה חדשה</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">אימות סיסמה</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {pwMsg && (
            <div className={`rounded-xl px-4 py-2.5 text-sm ${pwMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {pwMsg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'מעדכן...' : 'עדכן סיסמה'}
          </button>
        </form>
      </Card>
    </div>
  );
}

