import { useEffect, useRef, useState } from 'react';
import {
  LogOut,
  MapPin,
  QrCode,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  Send,
  CalendarDays,
  AlertTriangle,
  ScanLine,
  Navigation,
  UserCog,
  Mail,
  KeyRound,
  Lock,
  FileDown,
  Printer,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Attendance, EmployeeRequest, AllowedLocation, EmployeeLocation } from '@/types';
import { formatHebrewDate, formatTime, hoursBetween } from '@/lib/format';
import {
  monthKey,
  monthLabel,
  monthDateRange,
  computeMonthlySummary,
  parseHours,
  printMonthlyReport,
  downloadMonthlyReportCsv,
} from '@/lib/monthlyReport';
import { Avatar, Badge, Card, SectionTitle } from '@/components/ui';

type Tab = 'clock' | 'request' | 'history' | 'account';

type IconType = typeof Clock;

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startTime).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <>
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </>
  );
}

function NavButton({ active, onClick, label, Icon }: { active: boolean; onClick: () => void; label: string; Icon: IconType }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        active ? 'bg-brand-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export default function EmployeeView() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('clock');

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-800">BeZman</p>
              <p className="text-[11px] text-slate-400">פתרונות נוכחות לעסקים · גליצקי פתרונות טכנולוגיים</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar name={profile?.full_name ?? '?'} size="sm" />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-slate-700">{profile?.full_name}</p>
                <p className="text-[11px] text-slate-400">{profile?.employee_number}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              title="התנתק"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <NavButton active={tab === 'clock'} onClick={() => setTab('clock')} label="דיווח נוכחות" Icon={Clock} />
          <NavButton active={tab === 'request'} onClick={() => setTab('request')} label="הגשת בקשה" Icon={Send} />
          <NavButton active={tab === 'history'} onClick={() => setTab('history')} label="היסטוריית דיווחים" Icon={History} />
          <NavButton active={tab === 'account'} onClick={() => setTab('account')} label="החשבון שלי" Icon={UserCog} />
        </div>

        {tab === 'clock' && <ClockPanel />}
        {tab === 'request' && <RequestPanel />}
        {tab === 'history' && <HistoryPanel />}
        {tab === 'account' && <AccountPanel />}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400">
          <p>
            פותח על ידי <span className="font-semibold text-slate-500">גליצקי פתרונות טכנולוגיים לעסקים</span> ·{' '}
            <a href="mailto:e0583296967@gmail.com" className="text-brand-600 underline underline-offset-2 hover:text-brand-700">
              e0583296967@gmail.com
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ---------------- Clock-in / out panel ---------------- */
type FlowStage = 'idle' | 'checking-gps' | 'gps-failed' | 'out-of-area' | 'scanning-qr' | 'qr-unapproved' | 'submitting';

function ClockPanel() {
  const { profile } = useAuth();
  const [today, setToday] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<FlowStage>('idle');
  const [locations, setLocations] = useState<AllowedLocation[]>([]);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [nearest, setNearest] = useState<AllowedLocation | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingAction = useRef<'in' | 'out' | null>(null);
  const methodRef = useRef<'qr' | 'location' | null>(null);

  async function loadToday() {
    setLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', profile!.id)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })
      .maybeSingle();
    setToday((data as Attendance) ?? null);
    setLoading(false);
  }

  async function loadLocations() {
    const [locRes, elRes] = await Promise.all([
      supabase.from('allowed_locations').select('*'),
      supabase.from('employee_locations').select('*, location:allowed_locations(*)').eq('employee_id', profile!.id),
    ]);
    const allLocs = (locRes.data as AllowedLocation[]) ?? [];
    const myLinks = (elRes.data as (EmployeeLocation & { location: AllowedLocation })[]) ?? [];
    const assignedLocs = myLinks.map((l) => l.location).filter(Boolean) as AllowedLocation[];
    setLocations(assignedLocs.length > 0 ? assignedLocs : allLocs);
  }

  useEffect(() => {
    loadToday();
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (scanTimer.current) {
      clearInterval(scanTimer.current);
      scanTimer.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  // QR scanner
  useEffect(() => {
    if (stage !== 'scanning-qr') return;
    let active = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const anyWindow = window as unknown as { BarcodeDetector?: unknown };
        if (typeof anyWindow.BarcodeDetector === 'function') {
          const BD = anyWindow.BarcodeDetector as { new (opts: unknown): { detect: (i: unknown) => Promise<{ rawValue?: string }[]> } };
          const detector = new BD({ formats: ['qr_code'] });
          scanTimer.current = setInterval(async () => {
            if (!videoRef.current) return;
            try {
              const results = await detector.detect(videoRef.current);
              if (results && results.length > 0 && results[0].rawValue) {
                onQrSuccess(results[0].rawValue);
              }
            } catch {
              /* ignore frame errors */
            }
          }, 600);
        }
      } catch {
        setStage('qr-unapproved');
        setMsg({ type: 'err', text: 'לא ניתן לפתוח את המצלמה. ודא שהדפדפן מורשה להשתמש במצלמה.' });
      }
    }
    start();

    return () => {
      active = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function onQrSuccess(rawValue: string) {
    stopCamera();
    let parsed: { type?: string; id?: string; name?: string } = {};
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      parsed = {};
    }
    if (parsed.type !== 'workplace' || !parsed.id) {
      setStage('qr-unapproved');
      setMsg({ type: 'err', text: 'קוד ה-QR שנסרק אינו תקין.' });
      return;
    }
    const approved = locations.find((l) => l.id === parsed.id);
    if (!approved) {
      setStage('qr-unapproved');
      setMsg({ type: 'err', text: 'קוד QR אינו מאושר לעובד זה.' });
      return;
    }
    setNearest(approved);
    submitAttendance(approved, null);
  }

  function startLocationFlow() {
    setMsg(null);
    methodRef.current = 'location';
    setStage('checking-gps');
    if (locations.length === 0) {
      setStage('gps-failed');
      setMsg({ type: 'err', text: 'אין מקומות מותרים מוגדרים עבורך. פנה למנהל.' });
      return;
    }
    if (!navigator.geolocation) {
      setStage('gps-failed');
      setMsg({ type: 'err', text: 'המכשיר אינו תומך באיתור מיקום.' });
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStage('gps-failed');
      setMsg({
        type: 'err',
        text: 'דפדפן דורש חיבור מאובטח (HTTPS) לגישה למיקום. יש לפתוח את האתר דרך כתובת מאובטחת.',
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGps({ lat: latitude, lng: longitude });
        let best: AllowedLocation | null = null;
        let bestDist = Infinity;
        for (const loc of locations) {
          const d = haversine(latitude, longitude, Number(loc.lat), Number(loc.lng));
          if (d < bestDist) {
            bestDist = d;
            best = loc;
          }
        }
        if (best && bestDist <= best.radius_meters) {
          setNearest(best);
          submitAttendance(best, { lat: latitude, lng: longitude });
        } else {
          setNearest(null);
          setStage('out-of-area');
          setMsg({ type: 'err', text: 'המיקום אינו באזור מותר. יש להיות בתוך אזור העבודה לדיווח.' });
        }
      },
      (err) => {
        setStage('gps-failed');
        let text = 'שגיאה באיתור המיקום.';
        if (err.code === err.PERMISSION_DENIED) {
          text = 'גישה למיקום נדחתה. יש לאפשר גישה למיקום בהגדרות הדפדפן ובהגדרות המכשיר כדי לדווח.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          text = 'לא ניתן לאתר את המיקום. יש לוודא ש-GPS מופעל ויש קליטה, ולנסות שוב.';
        } else if (err.code === err.TIMEOUT) {
          text = 'איתור המיקום ארך זמן רב מדי. יש לנסות שוב באזור פתוח.';
        }
        setMsg({ type: 'err', text });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function startQrFlow() {
    if (stage !== 'idle') return;
    setMsg(null);
    methodRef.current = 'qr';
    setNearest(null);
    setGps(null);
    const isClockOut = !!today?.clock_in && !today?.clock_out;
    pendingAction.current = isClockOut ? 'out' : 'in';
    setStage('scanning-qr');
  }

  function startLocationFlowDirect() {
    if (stage !== 'idle') return;
    const isClockOut = !!today?.clock_in && !today?.clock_out;
    pendingAction.current = isClockOut ? 'out' : 'in';
    startLocationFlow();
  }

  async function submitAttendance(loc?: AllowedLocation | null, coords?: { lat: number; lng: number } | null) {
    setStage('submitting');
    const isClockIn = pendingAction.current === 'in';
    const method = methodRef.current;
    const usedLoc = loc !== undefined ? loc : nearest;
    const usedCoords = coords !== undefined ? coords : gps;
    const locationVerified = method === 'location' ? !!usedLoc : false;
    const qrVerified = method === 'qr';
    if (isClockIn) {
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          user_id: profile!.id,
          clock_in: new Date().toISOString(),
          lat: usedCoords?.lat ?? null,
          lng: usedCoords?.lng ?? null,
          location_verified: locationVerified,
          qr_verified: qrVerified,
          note: method === 'location' ? (usedLoc?.name ?? 'דיווח לפי מיקום') : 'דיווח לפי קוד QR',
          status: 'approved',
        })
        .select('*')
        .maybeSingle();
      if (error) {
        setMsg({ type: 'err', text: 'הדיווח נכשל. נסה שוב.' });
        setStage('idle');
      } else {
        setToday((data as Attendance) ?? null);
        setMsg({ type: 'ok', text: 'הכניסה נרשמה בהצלחה!' });
        setStage('idle');
      }
    } else {
      const { data, error } = await supabase
        .from('attendance')
        .update({
          clock_out: new Date().toISOString(),
          location_verified: locationVerified,
          qr_verified: qrVerified,
        })
        .eq('id', today!.id)
        .select('*')
        .maybeSingle();
      if (error) {
        setMsg({ type: 'err', text: 'עדכון היציאה נכשל.' });
        setStage('idle');
      } else {
        setToday((data as Attendance) ?? null);
        setMsg({ type: 'ok', text: 'היציאה נרשמה בהצלחה!' });
        setStage('idle');
      }
    }
    pendingAction.current = null;
    methodRef.current = null;
  }

  function cancelFlow() {
    stopCamera();
    setStage('idle');
    setMsg(null);
    pendingAction.current = null;
    methodRef.current = null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isClockedIn = !!today?.clock_in;
  const isClockedOut = !!today?.clock_out;
  const busy = stage === 'checking-gps' || stage === 'scanning-qr' || stage === 'submitting';

  return (
    <div className="space-y-5">
      {/* Status summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">היום, {formatHebrewDate(new Date())}</p>
            <p className="mt-1 text-lg font-extrabold text-slate-800">
              {isClockedIn ? (isClockedOut ? 'סיימת את היום' : 'נוכח כעת') : 'טרם דיווחת הגעה'}
            </p>
          </div>
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full text-white ${
              isClockedIn ? (isClockedOut ? 'bg-slate-400' : 'bg-emerald-500 pulse-ring') : 'bg-slate-300'
            }`}
          >
            <Clock className="h-8 w-8" />
          </div>
        </div>
        {isClockedIn && !isClockedOut && (
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-center text-white shadow-md">
            <p className="text-[11px] font-medium text-emerald-50">זמן עבודה כעת</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums tracking-tight">
              <LiveTimer startTime={today.clock_in} />
            </p>
          </div>
        )}
        {isClockedIn && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">כניסה</p>
              <p className="text-sm font-bold text-slate-700">{formatTime(today.clock_in)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">יציאה</p>
              <p className="text-sm font-bold text-slate-700">{formatTime(today.clock_out)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">סה"כ</p>
              <p className="text-sm font-bold text-slate-700">{hoursBetween(today.clock_in, today.clock_out)}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Progress / error states */}
      {busy || stage === 'gps-failed' || stage === 'out-of-area' || stage === 'qr-unapproved' ? (
        <Card className="p-5">
          <h3 className="mb-4 text-base font-bold text-slate-800">תהליך הדיווח</h3>
          <div className="space-y-3">
            {/* GPS step */}
            {(methodRef.current === 'location' || stage === 'checking-gps' || stage === 'gps-failed' || stage === 'out-of-area') && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      stage === 'checking-gps'
                        ? 'bg-brand-100 text-brand-600'
                        : gps || stage === 'submitting'
                          ? 'bg-emerald-100 text-emerald-600'
                          : stage === 'gps-failed' || stage === 'out-of-area'
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {stage === 'checking-gps' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : gps || stage === 'submitting' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : stage === 'gps-failed' || stage === 'out-of-area' ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      <MapPin className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">אימות מיקום GPS</p>
                    <p className="text-xs text-slate-400">
                      {stage === 'checking-gps'
                        ? 'מאתר מיקום...'
                        : gps || stage === 'submitting'
                          ? nearest
                            ? `באזור מותר: ${nearest.name}`
                            : 'מיקום אומת'
                          : stage === 'gps-failed'
                            ? 'גישה למיקום נדחתה'
                            : stage === 'out-of-area'
                              ? 'מחוץ לאזור מותר'
                              : 'המכשיר יאתר את המיקום אוטומטית'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* QR step */}
            {(methodRef.current === 'qr' || stage === 'scanning-qr' || stage === 'qr-unapproved') && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      stage === 'scanning-qr'
                        ? 'bg-brand-100 text-brand-600'
                        : stage === 'submitting'
                          ? 'bg-emerald-100 text-emerald-600'
                          : stage === 'qr-unapproved'
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {stage === 'scanning-qr' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : stage === 'submitting' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : stage === 'qr-unapproved' ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      <QrCode className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">סריקת קוד QR</p>
                    <p className="text-xs text-slate-400">
                      {stage === 'scanning-qr'
                        ? 'מכוון את המצלמה אל הקוד...'
                        : stage === 'submitting'
                          ? 'הקוד אומת בהצלחה'
                          : stage === 'qr-unapproved'
                            ? 'קוד QR אינו מאושר לעובד זה'
                            : 'סרוק את הקוד המוצב באזור העבודה'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {(stage === 'gps-failed' || stage === 'out-of-area' || stage === 'qr-unapproved') && (
            <button
              onClick={cancelFlow}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-300"
            >
              <XCircle className="h-5 w-5" />
              סגירה
            </button>
          )}
        </Card>
      ) : null}

      {/* Direct action buttons */}
      {isClockedOut ? (
        <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-200 px-4 py-4 text-lg font-extrabold text-slate-500">
          <CheckCircle2 className="h-6 w-6" />
          סיימת את הדיווח להיום
        </div>
      ) : busy ? (
        <button
          onClick={cancelFlow}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-200 px-4 py-4 text-lg font-extrabold text-slate-600 transition hover:bg-slate-300"
        >
          <XCircle className="h-6 w-6" />
          ביטול
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={startQrFlow}
            className={`flex flex-col items-center gap-2 rounded-2xl px-4 py-5 text-white shadow-lg transition ${
              isClockedIn ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            <QrCode className="h-8 w-8" />
            <span className="text-sm font-extrabold">{isClockedIn ? 'יציאה ב-QR' : 'כניסה ב-QR'}</span>
            <span className="text-[11px] opacity-80">סרוק קוד</span>
          </button>
          <button
            onClick={startLocationFlowDirect}
            disabled={locations.length === 0}
            className={`flex flex-col items-center gap-2 rounded-2xl px-4 py-5 text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isClockedIn ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            <MapPin className="h-8 w-8" />
            <span className="text-sm font-extrabold">{isClockedIn ? 'יציאה במיקום' : 'כניסה במיקום'}</span>
            <span className="text-[11px] opacity-80">אימות GPS</span>
          </button>
        </div>
      )}
      {locations.length === 0 && !isClockedOut && !busy && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          אין מקומות מותרים מוגדרים עבורך. פנה למנהל.
        </div>
      )}

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium animate-fade-in ${
            msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {msg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {/* QR Scanner modal */}
      {stage === 'scanning-qr' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
          <div className="relative w-full max-w-sm animate-scale-in rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">סריקת קוד QR</h3>
              <button onClick={cancelFlow} className="text-slate-400 hover:text-slate-600">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-900">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-8 rounded-2xl border-2 border-accent-400/80" />
                <div className="scan-beam absolute inset-x-8 h-0.5 bg-accent-400 shadow-[0_0_12px_2px_rgba(249,115,22,0.7)]" />
              </div>
              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 text-xs text-white/80">
                <ScanLine className="h-4 w-4" />
                מכוון את המצלמה אל הקוד
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              <Navigation className="mx-auto mb-1 h-4 w-4 text-accent-500" />
              מאתר קוד... הסריקה תאושר אוטומטית
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Request panel ---------------- */
function RequestPanel() {
  const { profile } = useAuth();
  const [type, setType] = useState('התאמת שעות');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [myRequests, setMyRequests] = useState<EmployeeRequest[]>([]);

  async function loadMine() {
    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setMyRequests((data as EmployeeRequest[]) ?? []);
  }

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from('requests').insert({
      user_id: profile!.id,
      type,
      description: description.trim() || null,
      requested_date: date || null,
      status: 'pending',
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'err', text: 'שליחת הבקשה נכשלה.' });
    } else {
      setMsg({ type: 'ok', text: 'הבקשה נשלחה למנהל בהצלחה!' });
      setDescription('');
      setDate('');
      loadMine();
    }
  }

  const types = ['התאמת שעות', 'חופשה', 'מחלה', 'שעות נוספות'];

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle title="הגשת בקשה למנהל" icon={<Send className="h-5 w-5" />} />
        <form onSubmit={submit} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">סוג הבקשה</label>
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                    type === t
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">תאריך מבוקש</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">תיאור הבקשה</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="פרט את הבקשה..."
              className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {msg && (
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
                msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {msg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {msg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            שלח בקשה
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle title="הבקשות שלי" icon={<History className="h-5 w-5" />} />
        <div className="divide-y divide-slate-100">
          {myRequests.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">אין בקשות עדיין</p>
          )}
          {myRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{r.type}</span>
                  <Badge
                    color={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}
                  >
                    {r.status === 'approved' ? 'אושר' : r.status === 'rejected' ? 'נדחה' : 'ממתין'}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-400">{r.description || '—'}</p>
                {r.manager_note && <p className="mt-1 text-xs text-brand-600">תגובת מנהל: {r.manager_note}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatHebrewDate(r.requested_date)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- History panel ---------------- */
function HistoryPanel() {
  const { profile } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(now));
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { start, end } = monthDateRange(selectedMonth);
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile.id)
        .gte('clock_in', start)
        .lte('clock_in', end)
        .order('clock_in', { ascending: false });
      setRecords((data as Attendance[]) ?? []);
      setLoading(false);
    })();
  }, [profile, selectedMonth]);

  const summary = computeMonthlySummary(records);

  function navigateMonth(dir: number) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(monthKey(d));
  }

  function handlePrint() {
    if (!profile || summary.records.length === 0) return;
    printMonthlyReport(profile, selectedMonth, summary);
  }

  function handleCsv() {
    if (!profile || summary.records.length === 0) return;
    downloadMonthlyReportCsv(profile, selectedMonth, summary);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <SectionTitle title="היסטוריית דיווחים" icon={<History className="h-5 w-5" />} />

      <div className="space-y-4 border-b border-slate-100 px-5 pb-5 pt-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <CalendarDays className="h-4 w-4 text-brand-600" />
              <span className="text-sm font-bold text-slate-800">{monthLabel(selectedMonth)}</span>
            </div>
            <button
              onClick={() => navigateMonth(1)}
              disabled={selectedMonth >= monthKey(now)}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {summary.records.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                <FileDown className="h-3.5 w-3.5" />
                Excel
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                <Printer className="h-3.5 w-3.5" />
                PDF
              </button>
            </div>
          )}
        </div>

        {summary.records.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-center">
              <p className="text-2xl font-extrabold text-brand-700">{summary.daysWorked}</p>
              <p className="text-xs text-brand-600">ימי עבודה</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-extrabold text-emerald-700">{summary.totalHours.toFixed(1)}</p>
              <p className="text-xs text-emerald-600">סה"כ שעות</p>
            </div>
            <div className="rounded-xl border border-accent-100 bg-accent-50 p-3 text-center">
              <p className="text-2xl font-extrabold text-accent-700">
                {summary.daysWorked > 0 ? (summary.totalHours / summary.daysWorked).toFixed(1) : '—'}
              </p>
              <p className="text-xs text-accent-600">ממוצע יומי</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-2xl font-extrabold text-slate-700">{summary.approved}</p>
              <p className="text-xs text-slate-500">מאושרים</p>
            </div>
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">
          אין דיווחים בחודש {monthLabel(selectedMonth)}
        </p>
      ) : (
        <>
          <div className="divide-y divide-slate-100">
            {records.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      a.location_verified || a.qr_verified
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{formatHebrewDate(a.clock_in)}</p>
                    <p className="text-xs text-slate-400">
                      {formatTime(a.clock_in)} — {formatTime(a.clock_out)} ·{' '}
                      {a.clock_out ? `${parseHours(a.clock_in, a.clock_out).toFixed(1)} שעות` : 'יציאה חסרה'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge color={a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'amber'}>
                    {a.status === 'approved' ? 'מאושר' : a.status === 'rejected' ? 'נדחה' : 'ממתין'}
                  </Badge>
                  <div className="flex gap-1">
                    {a.location_verified && <MapPin className="h-3.5 w-3.5 text-emerald-500" />}
                    {a.qr_verified && <QrCode className="h-3.5 w-3.5 text-brand-500" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t-2 border-slate-200 bg-slate-50 px-5 py-3">
            <span className="text-sm font-extrabold text-slate-700">סה"כ חודשי</span>
            <span className="text-lg font-extrabold text-brand-700">{summary.totalHours.toFixed(1)} שעות</span>
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------------- Account panel ---------------- */
function AccountPanel() {
  const { profile, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [passBusy, setPassBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      supabase.auth.getUser().then(({ data }) => {
        const addr = data?.user?.email ?? '';
        setEmail(addr);
      });
    }
  }, [profile]);

  async function updateEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    if (!email.trim()) {
      setEmailMsg({ type: 'err', text: 'נא להזין כתובת אימייל.' });
      return;
    }
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setEmailBusy(false);
    if (error) {
      setEmailMsg({ type: 'err', text: error.message });
    } else {
      setEmailMsg({ type: 'ok', text: 'כתובת האימייל עודכנה. ייתכן שתישלח הודעת אישור לכתובת החדשה.' });
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg(null);
    if (newPass.length < 6) {
      setPassMsg({ type: 'err', text: 'הסיסמה חייבת להכיל לפחות 6 תווים.' });
      return;
    }
    setPassBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setPassBusy(false);
    if (error) {
      setPassMsg({ type: 'err', text: error.message });
    } else {
      setPassMsg({ type: 'ok', text: 'הסיסמה עודכנה בהצלחה!' });
      setNewPass('');
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle title="עדכון כתובת אימייל (שם משתמש)" icon={<Mail className="h-5 w-5" />} />
        <form onSubmit={updateEmail} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">כתובת אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
              placeholder="you@example.com"
            />
          </div>
          {emailMsg && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${emailMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {emailMsg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {emailMsg.text}
            </div>
          )}
          <button type="submit" disabled={emailBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {emailBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
            עדכן אימייל
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle title="החלפת סיסמה" icon={<KeyRound className="h-5 w-5" />} />
        <form onSubmit={updatePassword} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">סיסמה חדשה</label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
              placeholder="לפחות 6 תווים"
            />
          </div>
          {passMsg && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${passMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {passMsg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {passMsg.text}
            </div>
          )}
          <button type="submit" disabled={passBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {passBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
            עדכן סיסמה
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle title="התנתקות" icon={<LogOut className="h-5 w-5" />} />
        <div className="p-5">
          <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 font-bold text-white transition hover:bg-rose-600">
            <LogOut className="h-5 w-5" />
            התנתק מהחשבון
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
