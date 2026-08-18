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
import { updateUserAuth } from '@/lib/updateAuth';
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
  localDateKey,
  requestsForAttendanceDay,
  formatChangeRequestsPlain,
} from '@/lib/monthlyReport';
import {
  formatHoursAdjustmentPayload,
  HOURS_ADJUST_TYPE,
  hoursAdjustmentSummary,
  isHoursAdjustmentType,
  parseHoursAdjustment,
} from '@/lib/hoursAdjustment';
import { Avatar, Badge, Card, SectionTitle } from '@/components/ui';
import jsQR from 'jsqr';

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
            פותח על ידי <span className="font-semibold text-slate-500">גליצקי פתרונות טכנולוגיים לעסקים</span>
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
  const [todayRecords, setTodayRecords] = useState<Attendance[]>([]);
  const [openShift, setOpenShift] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<FlowStage>('idle');
  const [locations, setLocations] = useState<AllowedLocation[]>([]);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [nearest, setNearest] = useState<AllowedLocation | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRaf = useRef<number | null>(null);
  const pendingAction = useRef<'in' | 'out' | null>(null);
  const methodRef = useRef<'qr' | 'location' | null>(null);
  const locationsRef = useRef<AllowedLocation[]>([]);
  const qrHandledRef = useRef(false);
  const openShiftRef = useRef<Attendance | null>(null);

  locationsRef.current = locations;
  openShiftRef.current = openShift;

  async function loadToday() {
    setLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', profile!.id)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false });
    const rows = (data as Attendance[]) ?? [];
    const open = rows.find((r) => r.clock_in && !r.clock_out) ?? null;
    setTodayRecords(rows);
    setOpenShift(open);
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
    if (scanRaf.current != null) {
      cancelAnimationFrame(scanRaf.current);
      scanRaf.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  // QR scanner — jsQR works in Chrome/Safari/Firefox; BarcodeDetector is Chrome-only
  useEffect(() => {
    if (stage !== 'scanning-qr') return;
    let active = true;
    qrHandledRef.current = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        await video.play();

        const tick = () => {
          if (!active || qrHandledRef.current) return;
          const canvas = canvasRef.current;
          if (video.readyState >= 2 && canvas && video.videoWidth > 0) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
              if (code?.data) {
                onQrSuccess(code.data);
                return;
              }
            }
          }
          scanRaf.current = requestAnimationFrame(tick);
        };
        scanRaf.current = requestAnimationFrame(tick);
      } catch {
        setStage('qr-unapproved');
        setMsg({ type: 'err', text: 'לא ניתן לפתוח את המצלמה. ודא שהדפדפן מורשה להשתמש במצלמה, ושהאתר נפתח ב-HTTPS.' });
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
    if (qrHandledRef.current) return;
    qrHandledRef.current = true;
    stopCamera();
    const approved = matchWorkplaceQr(rawValue, locationsRef.current);
    if (!approved) {
      setStage('qr-unapproved');
      setMsg({ type: 'err', text: 'קוד ה-QR שנסרק אינו מאושר לעובד זה, או שאינו קוד מקום עבודה תקין.' });
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
    const isClockOut = !!openShiftRef.current;
    pendingAction.current = isClockOut ? 'out' : 'in';
    setStage('scanning-qr');
  }

  function startLocationFlowDirect() {
    if (stage !== 'idle') return;
    const isClockOut = !!openShiftRef.current;
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
    const currentOpen = openShiftRef.current;
    if (isClockIn) {
      const { error } = await supabase
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
        });
      if (error) {
        setMsg({ type: 'err', text: 'הדיווח נכשל. נסה שוב.' });
        setStage('idle');
      } else {
        setMsg({ type: 'ok', text: 'הכניסה נרשמה בהצלחה!' });
        setStage('idle');
        await loadToday();
      }
    } else {
      if (!currentOpen) {
        setMsg({ type: 'err', text: 'אין משמרת פתוחה ליציאה.' });
        setStage('idle');
      } else {
        const { error } = await supabase
          .from('attendance')
          .update({
            clock_out: new Date().toISOString(),
            location_verified: locationVerified || currentOpen.location_verified,
            qr_verified: qrVerified || currentOpen.qr_verified,
          })
          .eq('id', currentOpen.id);
        if (error) {
          setMsg({ type: 'err', text: 'עדכון היציאה נכשל.' });
          setStage('idle');
        } else {
          setMsg({ type: 'ok', text: 'היציאה נרשמה בהצלחה! אפשר לדווח כניסה נוספת מאוחר יותר.' });
          setStage('idle');
          await loadToday();
        }
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

  const isOnShift = !!openShift;
  const lastRecord = todayRecords[0] ?? null;
  const busy = stage === 'checking-gps' || stage === 'scanning-qr' || stage === 'submitting';
  const dayHours = todayRecords.reduce((sum, r) => sum + parseHours(r.clock_in, r.clock_out), 0);

  return (
    <div className="space-y-5">
      {/* Status summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">היום, {formatHebrewDate(new Date())}</p>
            <p className="mt-1 text-lg font-extrabold text-slate-800">
              {isOnShift ? 'נוכח כעת' : todayRecords.length > 0 ? 'מחוץ למשמרת · אפשר לדווח שוב' : 'טרם דיווחת הגעה'}
            </p>
          </div>
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full text-white ${
              isOnShift ? 'bg-emerald-500 pulse-ring' : todayRecords.length > 0 ? 'bg-slate-400' : 'bg-slate-300'
            }`}
          >
            <Clock className="h-8 w-8" />
          </div>
        </div>
        {isOnShift && openShift.clock_in && (
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-center text-white shadow-md">
            <p className="text-[11px] font-medium text-emerald-50">זמן עבודה כעת</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums tracking-tight">
              <LiveTimer startTime={openShift.clock_in} />
            </p>
          </div>
        )}
        {lastRecord && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">{isOnShift ? 'כניסה נוכחית' : 'כניסה אחרונה'}</p>
              <p className="text-sm font-bold text-slate-700">{formatTime(isOnShift ? openShift.clock_in : lastRecord.clock_in)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">יציאה</p>
              <p className="text-sm font-bold text-slate-700">
                {formatTime(isOnShift ? openShift.clock_out : lastRecord.clock_out)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">סה"כ היום</p>
              <p className="text-sm font-bold text-slate-700">{dayHours.toFixed(1)} שעות</p>
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
      {busy ? (
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
              isOnShift ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            <QrCode className="h-8 w-8" />
            <span className="text-sm font-extrabold">{isOnShift ? 'יציאה ב-QR' : 'כניסה ב-QR'}</span>
            <span className="text-[11px] opacity-80">סרוק קוד</span>
          </button>
          <button
            onClick={startLocationFlowDirect}
            disabled={locations.length === 0}
            className={`flex flex-col items-center gap-2 rounded-2xl px-4 py-5 text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isOnShift ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            <MapPin className="h-8 w-8" />
            <span className="text-sm font-extrabold">{isOnShift ? 'יציאה במיקום' : 'כניסה במיקום'}</span>
            <span className="text-[11px] opacity-80">אימות GPS</span>
          </button>
        </div>
      )}
      {locations.length === 0 && !busy && (
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

      {todayRecords.length > 0 && (
        <Card>
          <SectionTitle title="דיווחים היום" icon={<History className="h-5 w-5" />} />
          <div className="divide-y divide-slate-100">
            {[...todayRecords].reverse().map((a, i) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-700">משמרת {i + 1}</p>
                  <p className="text-xs text-slate-400">
                    {formatTime(a.clock_in)} — {formatTime(a.clock_out)} ·{' '}
                    {a.clock_out ? hoursBetween(a.clock_in, a.clock_out) : 'פתוחה'}
                  </p>
                </div>
                <Badge color={!a.clock_out ? 'green' : a.status === 'approved' ? 'green' : 'amber'}>
                  {!a.clock_out ? 'פעילה' : a.status === 'approved' ? 'הושלמה' : 'ממתין'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
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
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
              <canvas ref={canvasRef} className="hidden" />
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
  const [type, setType] = useState(HOURS_ADJUST_TYPE);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [wantIn, setWantIn] = useState(true);
  const [wantOut, setWantOut] = useState(true);
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [myRequests, setMyRequests] = useState<EmployeeRequest[]>([]);

  const hoursMode = isHoursAdjustmentType(type);

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

  useEffect(() => {
    if (!hoursMode || !date || !profile) return;
    (async () => {
      const [y, m, d] = date.split('-').map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
      const end = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
      const { data } = await supabase
        .from('attendance')
        .select('clock_in, clock_out')
        .eq('user_id', profile.id)
        .gte('clock_in', start)
        .lte('clock_in', end)
        .order('clock_in', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      const toTime = (iso: string | null) => {
        if (!iso) return '';
        const dt = new Date(iso);
        if (isNaN(dt.getTime())) return '';
        return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      };
      if (data.clock_in) setClockIn(toTime(data.clock_in));
      if (data.clock_out) setClockOut(toTime(data.clock_out));
    })();
  }, [hoursMode, date, profile]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    let payloadDescription = description.trim() || null;
    if (hoursMode) {
      if (!date) {
        setBusy(false);
        setMsg({ type: 'err', text: 'נא לבחור את התאריך שצריך להתאים.' });
        return;
      }
      if ((!wantIn || !clockIn) && (!wantOut || !clockOut)) {
        setBusy(false);
        setMsg({ type: 'err', text: 'נא לבחור כניסה ו/או יציאה ולמלא שעה.' });
        return;
      }
      const inTime = wantIn ? clockIn : '';
      const outTime = wantOut ? clockOut : '';
      if (inTime && outTime && outTime <= inTime) {
        setBusy(false);
        setMsg({ type: 'err', text: 'שעת היציאה צריכה להיות אחרי שעת הכניסה.' });
        return;
      }
      payloadDescription = formatHoursAdjustmentPayload({
        clockIn: inTime || null,
        clockOut: outTime || null,
        note: description.trim(),
      });
    }

    const { error } = await supabase.from('requests').insert({
      user_id: profile!.id,
      type,
      description: payloadDescription,
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
      setClockIn('');
      setClockOut('');
      setWantIn(true);
      setWantOut(true);
      loadMine();
    }
  }

  const types = [HOURS_ADJUST_TYPE, 'חופשה', 'מחלה', 'שעות נוספות'];

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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              תאריך מבוקש {hoursMode ? <span className="text-rose-500">*</span> : null}
            </label>
            <input
              type="date"
              required={hoursMode}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {hoursMode && (
            <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
              <p className="text-sm font-medium text-slate-700">איזו שעה לתקן?</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={`rounded-xl border bg-white p-3 ${wantIn ? 'border-brand-400' : 'border-slate-200'}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <input type="checkbox" checked={wantIn} onChange={(e) => setWantIn(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                    <span className="text-sm font-bold text-slate-700">כניסה</span>
                  </div>
                  <input
                    type="time"
                    dir="ltr"
                    disabled={!wantIn}
                    value={clockIn}
                    onChange={(e) => setClockIn(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800 outline-none focus:border-brand-500 disabled:opacity-40"
                  />
                </label>
                <label className={`rounded-xl border bg-white p-3 ${wantOut ? 'border-brand-400' : 'border-slate-200'}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <input type="checkbox" checked={wantOut} onChange={(e) => setWantOut(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                    <span className="text-sm font-bold text-slate-700">יציאה</span>
                  </div>
                  <input
                    type="time"
                    dir="ltr"
                    disabled={!wantOut}
                    value={clockOut}
                    onChange={(e) => setClockOut(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800 outline-none focus:border-brand-500 disabled:opacity-40"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">אחרי שהמנהל יאשר, השעות בדיווח יתעדכנו אוטומטית.</p>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {hoursMode ? 'הערה (לא חובה)' : 'תיאור הבקשה'}
            </label>
            <textarea
              required={!hoursMode}
              rows={hoursMode ? 2 : 4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={hoursMode ? 'למשל: שכחתי לדווח יציאה...' : 'פרט את הבקשה...'}
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
          {myRequests.map((r) => {
            const adj = isHoursAdjustmentType(r.type) ? parseHoursAdjustment(r.description) : null;
            return (
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
                {adj ? (
                  <p className="mt-0.5 text-xs font-medium text-slate-600">{hoursAdjustmentSummary(adj)}</p>
                ) : (
                  <p className="mt-0.5 truncate text-xs text-slate-400">{r.description || '—'}</p>
                )}
                {adj?.note && <p className="mt-0.5 truncate text-xs text-slate-400">{adj.note}</p>}
                {r.manager_note && <p className="mt-1 text-xs text-brand-600">תגובת מנהל: {r.manager_note}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatHebrewDate(r.requested_date)}
              </div>
            </div>
            );
          })}
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
  const [monthRequests, setMonthRequests] = useState<EmployeeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { start, end } = monthDateRange(selectedMonth);
      const [{ data }, { data: reqData }] = await Promise.all([
        supabase
          .from('attendance')
          .select('*')
          .eq('user_id', profile.id)
          .gte('clock_in', start)
          .lte('clock_in', end)
          .order('clock_in', { ascending: false }),
        supabase
          .from('requests')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }),
      ]);
      setRecords((data as Attendance[]) ?? []);
      const inMonth = ((reqData as EmployeeRequest[]) ?? []).filter((r) => {
        const key = localDateKey(r.requested_date);
        return key.startsWith(selectedMonth);
      });
      setMonthRequests(inMonth);
      setLoading(false);
    })();
  }, [profile, selectedMonth]);

  const summary = computeMonthlySummary(records, monthRequests);

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
          <div className={`grid grid-cols-2 gap-3 ${summary.changeRequests.length > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
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
            {summary.changeRequests.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-2xl font-extrabold text-slate-700">{summary.changeRequests.length}</p>
                <p className="text-xs text-slate-500">בקשות שינוי</p>
              </div>
            )}
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
            {records.map((a) => {
              const dayReqs = requestsForAttendanceDay(a.user_id, a.clock_in, monthRequests);
              return (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      a.location_verified || a.qr_verified
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700">{formatHebrewDate(a.clock_in)}</p>
                    <p className="text-xs text-slate-400">
                      {formatTime(a.clock_in)} — {formatTime(a.clock_out)} ·{' '}
                      {a.clock_out ? `${parseHours(a.clock_in, a.clock_out).toFixed(1)} שעות` : 'יציאה חסרה'}
                    </p>
                    {dayReqs.length > 0 && (
                      <p className="mt-1 text-[11px] leading-snug text-slate-600">{formatChangeRequestsPlain(dayReqs)}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-1">
                    {a.location_verified && <MapPin className="h-3.5 w-3.5 text-emerald-500" />}
                    {a.qr_verified && <QrCode className="h-3.5 w-3.5 text-brand-500" />}
                  </div>
                </div>
              </div>
              );
            })}
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
  const { profile, session, signOut } = useAuth();
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
    if (!session?.user?.id) {
      setEmailMsg({ type: 'err', text: 'לא נמצא משתמש מחובר.' });
      return;
    }
    setEmailBusy(true);
    const { error, applied } = await updateUserAuth({ userId: session.user.id, email: email.trim() });
    setEmailBusy(false);
    if (error) {
      setEmailMsg({ type: 'err', text: error });
      return;
    }
    if (!applied) {
      setEmailMsg({ type: 'err', text: 'האימייל לא הוחל מיד. נסה שוב.' });
      return;
    }
    setEmailMsg({ type: 'ok', text: 'האימייל עודכן מיד, בלי מייל אישור. התחבר מחדש עם האימייל החדש.' });
    setTimeout(() => signOut(), 2500);
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg(null);
    if (newPass.length < 6) {
      setPassMsg({ type: 'err', text: 'הסיסמה חייבת להכיל לפחות 6 תווים.' });
      return;
    }
    if (!session?.user?.id) {
      setPassMsg({ type: 'err', text: 'לא נמצא משתמש מחובר.' });
      return;
    }
    setPassBusy(true);
    const { error } = await updateUserAuth({ userId: session.user.id, password: newPass });
    setPassBusy(false);
    if (error) {
      setPassMsg({ type: 'err', text: error });
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
          <p className="text-xs text-slate-400">האימייל מתעדכן מיד, בלי מייל אישור ובלי קישור.</p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">כתובת אימייל</label>
            <input
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-left text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
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
function matchWorkplaceQr(rawValue: string, locations: AllowedLocation[]): AllowedLocation | null {
  const raw = rawValue.trim();
  let parsed: { type?: string; id?: string; name?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  if (parsed.id) {
    const byId = locations.find((l) => l.id === parsed.id);
    if (byId && (!parsed.type || parsed.type === 'workplace')) return byId;
  }
  const byExactId = locations.find((l) => l.id === raw);
  if (byExactId) return byExactId;
  return locations.find((l) => raw.includes(l.id)) ?? null;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
