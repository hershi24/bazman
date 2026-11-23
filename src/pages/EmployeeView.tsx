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
  MessageSquarePlus,
  FileDown,
  Printer,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { updateUserAuth } from '@/lib/updateAuth';
import { useLang } from '@/lib/LanguageProvider';
import LanguageToggle from '@/components/LanguageToggle';
import {
  DAY_NAMES_SHORT_EN,
  DAY_NAMES_SHORT_HE,
  FEEDBACK_CATEGORY_KEYS,
  REQUEST_TYPES,
  localizeError,
  requestTypeLabel,
  statusLabel,
} from '@/lib/i18n';
import type { Attendance, EmployeeRequest, AllowedLocation, EmployeeLocation } from '@/types';
import { formatHebrewDate, formatTime, hoursBetween } from '@/lib/format';
import {
  monthKey,
  monthLabel,
  monthDateRange,
  computeMonthlySummary,
  printMonthlyReport,
  downloadMonthlyReportCsv,
  localDateKey,
  formatChangeRequestsPlain,
  requestsForAttendanceRecord,
  attendanceShiftCaption,
  dayNameLong,
} from '@/lib/monthlyReport';
import {
  formatHoursAdjustmentPayload,
  HOURS_ADJUST_TYPE,
  hoursAdjustmentSummary,
  originalHoursSummary,
  isHoursAdjustmentType,
  parseHoursAdjustment,
  timeFromIso,
  isOvernightClockTimes,
} from '@/lib/hoursAdjustment';
import { isActiveOpenShift, isTodayAttendance, israelYesterdayStart, openShiftLabel } from '@/lib/attendanceDay';
import { averageMinutes, formatHm, minutesBetween, minutesBetweenOrZero } from '@/lib/workDuration';
import { FEEDBACK_CATEGORIES, isDeveloperFeedbackType, sendDeveloperFeedback } from '@/lib/developerFeedback';
import { Avatar, Badge, Card, SectionTitle, TruncatedText } from '@/components/ui';
import jsQR from 'jsqr';

type Tab = 'clock' | 'request' | 'history' | 'feedback' | 'account';

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
  const { t, bindUser } = useLang();
  const [tab, setTab] = useState<Tab>('clock');

  useEffect(() => {
    if (profile?.id) bindUser(profile.id);
  }, [profile?.id, bindUser]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-800">BeZman</p>
              <p className="truncate text-[11px] text-slate-400">{t('brandTagline')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageToggle />
            <div className="flex items-center gap-2">
              <Avatar name={profile?.full_name ?? '?'} size="sm" />
              <div className="hidden text-start sm:block">
                <p className="text-sm font-bold text-slate-700">{profile?.full_name}</p>
                <p className="text-[11px] text-slate-400">{profile?.employee_number}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              title={t('signOut')}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <NavButton active={tab === 'clock'} onClick={() => setTab('clock')} label={t('tabClock')} Icon={Clock} />
          <NavButton active={tab === 'request'} onClick={() => setTab('request')} label={t('tabRequest')} Icon={Send} />
          <NavButton active={tab === 'history'} onClick={() => setTab('history')} label={t('tabHistory')} Icon={History} />
          <NavButton active={tab === 'feedback'} onClick={() => setTab('feedback')} label={t('tabFeedback')} Icon={MessageSquarePlus} />
          <NavButton active={tab === 'account'} onClick={() => setTab('account')} label={t('tabAccount')} Icon={UserCog} />
        </div>

        {tab === 'clock' && <ClockPanel />}
        {tab === 'request' && <RequestPanel />}
        {tab === 'history' && <HistoryPanel />}
        {tab === 'feedback' && <FeedbackPanel />}
        {tab === 'account' && <AccountPanel />}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400">
          <p>
            {t('developedBy')} <span className="font-semibold text-slate-500">{t('developedByName')}</span>
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
  const { t, lang } = useLang();
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
    const lookbackIso = israelYesterdayStart().toISOString();
    const [{ data: recent }, { data: openRows }] = await Promise.all([
      supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile!.id)
        .gte('clock_in', lookbackIso)
        .order('clock_in', { ascending: false }),
      supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile!.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(10),
    ]);
    const byId = new Map<string, Attendance>();
    for (const row of [...((recent as Attendance[]) ?? []), ...((openRows as Attendance[]) ?? [])]) {
      byId.set(row.id, row);
    }
    const rows = Array.from(byId.values()).sort(
      (a, b) => new Date(b.clock_in ?? 0).getTime() - new Date(a.clock_in ?? 0).getTime(),
    );
    const open = rows.find((r) => isActiveOpenShift(r)) ?? null;
    setTodayRecords(rows.filter((r) => isTodayAttendance(r)));
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
        setMsg({ type: 'err', text: t('cameraDenied') });
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
      setMsg({ type: 'err', text: t('qrNotApproved') });
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
      setMsg({ type: 'err', text: t('noLocations') });
      return;
    }
    if (!navigator.geolocation) {
      setStage('gps-failed');
      setMsg({ type: 'err', text: t('noGeo') });
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStage('gps-failed');
      setMsg({
        type: 'err',
        text: t('needHttps'),
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
          setMsg({ type: 'err', text: t('outOfArea') });
        }
      },
      (err) => {
        setStage('gps-failed');
        let text = t('gpsError');
        if (err.code === err.PERMISSION_DENIED) {
          text = t('gpsDenied');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          text = t('gpsUnavailable');
        } else if (err.code === err.TIMEOUT) {
          text = t('gpsTimeout');
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
        setMsg({ type: 'err', text: t('clockFailed') });
        setStage('idle');
      } else {
        setMsg({ type: 'ok', text: t('clockInOk') });
        setStage('idle');
        await loadToday();
      }
    } else {
      if (!currentOpen) {
        setMsg({ type: 'err', text: t('noOpenShift') });
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
          setMsg({ type: 'err', text: t('clockOutFailed') });
          setStage('idle');
        } else {
          setMsg({ type: 'ok', text: t('clockOutOk') });
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
  const dayMinutes = todayRecords.reduce((sum, r) => sum + minutesBetweenOrZero(r.clock_in, r.clock_out), 0);

  return (
    <div className="space-y-5">
      {/* Status summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{t('today', { date: formatHebrewDate(new Date(), lang) })}</p>
            <p className="mt-1 text-lg font-extrabold text-slate-800">
              {isOnShift ? t('statusOnShift') : todayRecords.length > 0 ? t('statusOffShift') : t('statusNotIn')}
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
            <p className="text-[11px] font-medium text-emerald-50">{t('workTimeNow')}</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums tracking-tight">
              <LiveTimer startTime={openShift.clock_in} />
            </p>
          </div>
        )}
        {lastRecord && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">{isOnShift ? t('currentClockIn') : t('lastClockIn')}</p>
              <p className="text-sm font-bold text-slate-700">{formatTime(isOnShift ? openShift.clock_in : lastRecord.clock_in)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">{t('clockOut')}</p>
              <p className="text-sm font-bold text-slate-700">
                {formatTime(isOnShift ? openShift.clock_out : lastRecord.clock_out)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-400">{t('totalToday')}</p>
              <p dir="ltr" className="text-sm font-bold tabular-nums text-slate-700">{formatHm(dayMinutes)} {t('hoursUnit')}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Progress / error states */}
      {busy || stage === 'gps-failed' || stage === 'out-of-area' || stage === 'qr-unapproved' ? (
        <Card className="p-5">
          <h3 className="mb-4 text-base font-bold text-slate-800">{t('reportProcess')}</h3>
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
                    <p className="text-sm font-bold text-slate-700">{t('gpsVerify')}</p>
                    <p className="text-xs text-slate-400">
                      {stage === 'checking-gps'
                        ? t('locating')
                        : gps || stage === 'submitting'
                          ? nearest
                            ? t('inAllowedArea', { name: nearest.name })
                            : t('locationVerified')
                          : stage === 'gps-failed'
                            ? t('locationDenied')
                            : stage === 'out-of-area'
                              ? t('outsideArea')
                              : t('deviceWillLocate')}
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
                    <p className="text-sm font-bold text-slate-700">{t('qrScan')}</p>
                    <p className="text-xs text-slate-400">
                      {stage === 'scanning-qr'
                        ? t('aimCamera')
                        : stage === 'submitting'
                          ? t('qrVerified')
                          : stage === 'qr-unapproved'
                            ? t('qrNotApprovedShort')
                            : t('scanWorkplaceQr')}
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
              {t('close')}
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
          {t('cancel')}
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
            <span className="text-sm font-extrabold">{isOnShift ? t('clockOutQr') : t('clockInQr')}</span>
            <span className="text-[11px] opacity-80">{t('scanCode')}</span>
          </button>
          <button
            onClick={startLocationFlowDirect}
            disabled={locations.length === 0}
            className={`flex flex-col items-center gap-2 rounded-2xl px-4 py-5 text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isOnShift ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            <MapPin className="h-8 w-8" />
            <span className="text-sm font-extrabold">{isOnShift ? t('clockOutGps') : t('clockInGps')}</span>
            <span className="text-[11px] opacity-80">{t('gpsVerifyShort')}</span>
          </button>
        </div>
      )}
      {locations.length === 0 && !busy && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          {t('noLocations')}
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
          <SectionTitle title={t('todayReports')} icon={<History className="h-5 w-5" />} />
          <div className="divide-y divide-slate-100">
            {[...todayRecords].reverse().map((a, i) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-700">{t('shiftN', { n: i + 1 })}</p>
                  <p className="text-xs text-slate-400">
                    {formatTime(a.clock_in)} — {formatTime(a.clock_out)} ·{' '}
                    {a.clock_out ? hoursBetween(a.clock_in, a.clock_out, lang) : t('open')}
                  </p>
                </div>
                <Badge color={!a.clock_out ? 'green' : a.status === 'approved' ? 'green' : 'amber'}>
                  {!a.clock_out ? t('active') : a.status === 'approved' ? t('completed') : t('pending')}
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
              <h3 className="font-bold text-slate-800">{t('qrScan')}</h3>
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
                {t('aimAtCode')}
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              <Navigation className="mx-auto mb-1 h-4 w-4 text-accent-500" />
              {t('locatingCode')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkDateCalendar({
  value,
  onChange,
  workDays,
  monthKeyStr,
  onMonthChange,
}: {
  value: string;
  onChange: (date: string) => void;
  workDays: Set<string>;
  monthKeyStr: string;
  onMonthChange: (key: string) => void;
}) {
  const { t, lang, isRtl } = useLang();
  const dayShort = lang === 'en' ? DAY_NAMES_SHORT_EN : DAY_NAMES_SHORT_HE;
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const [y, m] = monthKeyStr.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startOffset = firstDay.getDay();
  const todayKey = localDateKey(new Date().toISOString());
  const workCount = Array.from(workDays).filter((k) => k.startsWith(monthKeyStr)).length;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function dayKey(day: number): string {
    return `${monthKeyStr}-${String(day).padStart(2, '0')}`;
  }

  function shiftMonth(dir: number) {
    onMonthChange(monthKey(new Date(y, m - 1 + dir, 1)));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label={t('prevMonth')}
        >
          <PrevIcon className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-extrabold text-slate-800">{monthLabel(monthKeyStr, lang)}</span>
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label={t('nextMonth')}
        >
          <NextIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {dayShort.map((name, i) => (
          <div
            key={`${name}-${i}`}
            className={`pb-1 text-center text-[11px] font-bold ${
              i === 5 ? 'text-amber-600' : i === 6 ? 'text-rose-500' : 'text-slate-400'
            }`}
            title={dayNameLong(i, lang)}
          >
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} className="h-10" />;
          const key = dayKey(day);
          const worked = workDays.has(key);
          const selected = value === key;
          const isToday = key === todayKey;
          const dow = (startOffset + day - 1) % 7;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`relative flex h-10 flex-col items-center justify-center rounded-xl text-sm font-bold transition ${
                selected
                  ? 'bg-brand-600 text-white shadow-sm'
                  : worked
                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : isToday
                      ? 'border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
                      : dow === 6
                        ? 'text-rose-400 hover:bg-rose-50'
                        : dow === 5
                          ? 'text-amber-600 hover:bg-amber-50'
                          : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{day}</span>
              {worked && (
                <span
                  className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${selected ? 'bg-white' : 'bg-emerald-500'}`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t('workDay')}
          {workCount > 0 ? t('workDaysThisMonth', { count: workCount }) : ''}
        </span>
        {value ? (
          <span className="font-semibold text-slate-700">{t('selectedDate', { date: formatHebrewDate(value, lang) })}</span>
        ) : (
          <span>{t('pickDateToFix')}</span>
        )}
      </div>
    </div>
  );
}

/* ---------------- Request panel ---------------- */
function RequestPanel() {
  const { profile } = useAuth();
  const { t, lang } = useLang();
  const [type, setType] = useState(HOURS_ADJUST_TYPE);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [wantIn, setWantIn] = useState(true);
  const [wantOut, setWantOut] = useState(true);
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [originalIn, setOriginalIn] = useState<string | null>(null);
  const [originalOut, setOriginalOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [myRequests, setMyRequests] = useState<EmployeeRequest[]>([]);
  const [dayShifts, setDayShifts] = useState<Attendance[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [calMonth, setCalMonth] = useState(() => monthKey(new Date()));
  const [workDays, setWorkDays] = useState<Set<string>>(() => new Set());

  const hoursMode = isHoursAdjustmentType(type);

  async function loadMine() {
    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setMyRequests(((data as EmployeeRequest[]) ?? []).filter((r) => !isDeveloperFeedbackType(r.type)));
  }

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile) return;
    const { start, end } = monthDateRange(calMonth);
    const startPad = new Date(new Date(start).getTime() - 86400000).toISOString();
    const endPad = new Date(new Date(end).getTime() + 86400000).toISOString();
    (async () => {
      const { data } = await supabase
        .from('attendance')
        .select('clock_in')
        .eq('user_id', profile.id)
        .gte('clock_in', startPad)
        .lte('clock_in', endPad);
      const keys = new Set(
        ((data as { clock_in: string | null }[]) ?? [])
          .map((r) => localDateKey(r.clock_in))
          .filter((k) => k.startsWith(calMonth)),
      );
      setWorkDays(keys);
    })();
  }, [profile, calMonth]);

  useEffect(() => {
    if (!hoursMode || !date || !profile) {
      setDayShifts([]);
      setSelectedShiftId('');
      return;
    }
    (async () => {
      const [y, m, d] = date.split('-').map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
      const end = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile.id)
        .gte('clock_in', start)
        .lte('clock_in', end)
        .order('clock_in', { ascending: true });
      const rows = ((data as Attendance[]) ?? []).filter((r) => localDateKey(r.clock_in) === date);
      setDayShifts(rows);
      const pick = rows.length === 1 ? rows[0] : null;
      setSelectedShiftId(pick?.id ?? '');
      if (!pick) {
        setOriginalIn(null);
        setOriginalOut(null);
        return;
      }
      const origIn = timeFromIso(pick.clock_in);
      const origOut = timeFromIso(pick.clock_out);
      setOriginalIn(origIn);
      setOriginalOut(origOut);
      if (origIn) setClockIn(origIn);
      if (origOut) setClockOut(origOut);
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
        setMsg({ type: 'err', text: t('needDate') });
        return;
      }
      if (dayShifts.length > 1 && !selectedShiftId) {
        setBusy(false);
        setMsg({ type: 'err', text: t('needShiftPick') });
        return;
      }
      if ((!wantIn || !clockIn) && (!wantOut || !clockOut)) {
        setBusy(false);
        setMsg({ type: 'err', text: t('needInOrOut') });
        return;
      }
      const inTime = wantIn ? clockIn : '';
      const outTime = wantOut ? clockOut : '';
      if (inTime && outTime && inTime === outTime) {
        setBusy(false);
        setMsg({ type: 'err', text: t('outAfterIn') });
        return;
      }
      const selectedShift =
        dayShifts.find((s) => s.id === selectedShiftId) ?? (dayShifts.length === 1 ? dayShifts[0] : null);
      payloadDescription = formatHoursAdjustmentPayload({
        clockIn: inTime || null,
        clockOut: outTime || null,
        originalClockIn: originalIn,
        originalClockOut: originalOut,
        note: description.trim(),
        attendanceId: selectedShift?.id ?? null,
        shiftNumber: selectedShift
          ? dayShifts.findIndex((s) => s.id === selectedShift.id) + 1
          : dayShifts.length > 0
            ? 1
            : null,
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
      setMsg({ type: 'err', text: t('requestFailed') });
    } else {
      setMsg({ type: 'ok', text: t('requestSent') });
      setDescription('');
      setDate('');
      setClockIn('');
      setClockOut('');
      setOriginalIn(null);
      setOriginalOut(null);
      setWantIn(true);
      setWantOut(true);
      setDayShifts([]);
      setSelectedShiftId('');
      loadMine();
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle title={t('submitRequestTitle')} icon={<Send className="h-5 w-5" />} />
        <form onSubmit={submit} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('requestType')}</label>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                    type === item.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t(item.key)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t('requestedDate')} {hoursMode ? <span className="text-rose-500">*</span> : null}
            </label>
            <p className="mb-2 text-xs text-slate-500">
              {t('calendarHint')}
            </p>
            <WorkDateCalendar
              value={date}
              onChange={setDate}
              workDays={workDays}
              monthKeyStr={calMonth}
              onMonthChange={setCalMonth}
            />
          </div>
          {hoursMode && dayShifts.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {t('shiftsTodayPick', { count: dayShifts.length })}
              </p>
              <div className="grid gap-2">
                {dayShifts.map((s, i) => {
                  const selected = selectedShiftId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedShiftId(s.id);
                        const origIn = timeFromIso(s.clock_in);
                        const origOut = timeFromIso(s.clock_out);
                        setOriginalIn(origIn);
                        setOriginalOut(origOut);
                        if (origIn) setClockIn(origIn);
                        if (origOut) setClockOut(origOut);
                      }}
                      className={`rounded-xl border px-4 py-3 text-start transition ${
                        selected
                          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100'
                          : 'border-slate-200 bg-white hover:border-brand-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-extrabold text-slate-800">{t('shiftN', { n: i + 1 })}</span>
                        <span className="text-sm font-bold tabular-nums text-slate-600" dir="ltr">
                          {timeFromIso(s.clock_in) ?? '—'} – {timeFromIso(s.clock_out) ?? t('open')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {hoursMode && date && dayShifts.length === 0 && (
            <p className="text-xs text-amber-700">{t('noReportYet')}</p>
          )}
          {hoursMode && (
            <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
              <p className="text-sm font-medium text-slate-700">{t('whichTime')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={`rounded-xl border bg-white p-3 ${wantIn ? 'border-brand-400' : 'border-slate-200'}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <input type="checkbox" checked={wantIn} onChange={(e) => setWantIn(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                    <span className="text-sm font-bold text-slate-700">{t('clockIn')}</span>
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
                    <span className="text-sm font-bold text-slate-700">{t('clockOut')}</span>
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
              {wantIn && wantOut && isOvernightClockTimes(clockIn, clockOut) && (
                <p className="text-xs font-medium text-emerald-700">
                  {t('overnightHint')}
                </p>
              )}
              <p className="text-xs text-slate-500">{t('afterApproveHint')}</p>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {hoursMode ? t('noteOptional') : t('requestDescription')}
            </label>
            <textarea
              required={!hoursMode}
              rows={hoursMode ? 2 : 4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={hoursMode ? t('notePlaceholder') : t('descPlaceholder')}
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
            {t('sendRequest')}
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle title={t('myRequests')} icon={<History className="h-5 w-5" />} />
        <div className="divide-y divide-slate-100">
          {myRequests.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">{t('noRequests')}</p>
          )}
          {myRequests.map((r) => {
            const adj = isHoursAdjustmentType(r.type) ? parseHoursAdjustment(r.description) : null;
            return (
            <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{requestTypeLabel(r.type, t, lang)}</span>
                  <Badge
                    color={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}
                  >
                    {statusLabel(r.status, t)}
                  </Badge>
                </div>
                {adj ? (
                  <>
                    <p className="mt-0.5 text-xs font-medium text-slate-600">{t('requested')}: {hoursAdjustmentSummary(adj, lang)}</p>
                    {originalHoursSummary(adj, lang) ? (
                      <p className="mt-0.5 text-xs text-slate-400">{t('beforeChange')}: {originalHoursSummary(adj, lang)}</p>
                    ) : null}
                  </>
                ) : (
                  <TruncatedText text={r.description || '—'} className="mt-0.5 text-xs text-slate-400" />
                )}
                {adj?.note && <TruncatedText text={adj.note} className="mt-0.5 text-xs text-slate-400" />}
                {r.manager_note && <p className="mt-1 text-xs text-brand-600">{t('managerReply')}: {r.manager_note}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatHebrewDate(r.requested_date, lang)}
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
  const { t, lang, isRtl } = useLang();
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
    printMonthlyReport(profile, selectedMonth, summary, lang);
  }

  function handleCsv() {
    if (!profile || summary.records.length === 0) return;
    downloadMonthlyReportCsv(profile, selectedMonth, summary, lang);
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
      <SectionTitle title={t('historyTitle')} icon={<History className="h-5 w-5" />} />

      <div className="space-y-4 border-b border-slate-100 px-5 pb-5 pt-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={t('prevMonth')}
            >
              {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <CalendarDays className="h-4 w-4 text-brand-600" />
              <span className="text-sm font-bold text-slate-800">{monthLabel(selectedMonth, lang)}</span>
            </div>
            <button
              onClick={() => navigateMonth(1)}
              disabled={selectedMonth >= monthKey(now)}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t('nextMonth')}
            >
              {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
              <p className="text-xs text-brand-600">{t('workDaysLabel')}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
              <p dir="ltr" className="text-2xl font-extrabold tabular-nums text-emerald-700">{formatHm(summary.totalMinutes)}</p>
              <p className="text-xs text-emerald-600">{t('totalHours')}</p>
            </div>
            <div className="rounded-xl border border-accent-100 bg-accent-50 p-3 text-center">
              <p dir="ltr" className="text-2xl font-extrabold tabular-nums text-accent-700">
                {formatHm(averageMinutes(summary.totalMinutes, summary.daysWorked))}
              </p>
              <p className="text-xs text-accent-600">{t('dailyAvg')}</p>
            </div>
            {summary.changeRequests.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-2xl font-extrabold text-slate-700">{summary.changeRequests.length}</p>
                <p className="text-xs text-slate-500">{t('changeRequests')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">
          {t('noReportsInMonth', { month: monthLabel(selectedMonth, lang) })}
        </p>
      ) : (
        <>
          <div className="divide-y divide-slate-100">
            {records.map((a) => {
              const dayReqs = requestsForAttendanceRecord(a, monthRequests, records);
              const shift = attendanceShiftCaption(a, records, lang);
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
                    <p className="text-sm font-bold text-slate-700">
                      {formatHebrewDate(a.clock_in, lang)}
                      {shift ? (
                        <span className="mr-2 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
                          {shift}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatTime(a.clock_in)} — {formatTime(a.clock_out)} ·{' '}
                      {a.clock_out
                        ? <span dir="ltr" className="tabular-nums">{formatHm(minutesBetween(a.clock_in, a.clock_out))} {t('hoursUnit')}</span>
                        : openShiftLabel(a, undefined, lang)}
                    </p>
                    {dayReqs.length > 0 && (
                      <p className="mt-1 text-[11px] leading-snug text-slate-600">{formatChangeRequestsPlain(dayReqs, a, lang)}</p>
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
            <span className="text-sm font-extrabold text-slate-700">{t('monthlyTotal')}</span>
            <span dir="ltr" className="text-lg font-extrabold tabular-nums text-brand-700">{formatHm(summary.totalMinutes)} {t('hoursUnit')}</span>
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------------- Feedback to developer ---------------- */
function FeedbackPanel() {
  const { t, lang } = useLang();
  const [category, setCategory] = useState<(typeof FEEDBACK_CATEGORIES)[number]>('הצעה');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const text = message.trim();
    if (text.length < 8) {
      setMsg({ type: 'err', text: t('feedbackTooShort') });
      return;
    }
    setBusy(true);
    const result = await sendDeveloperFeedback({
      category,
      message: text,
    });
    setBusy(false);
    if (result.error) {
      setMsg({ type: 'err', text: localizeError(result.error, t, lang) });
      return;
    }
    setMessage('');
    setMsg({ type: 'ok', text: t('feedbackSent') });
  }

  return (
    <Card>
      <SectionTitle title={t('feedbackTitle')} icon={<MessageSquarePlus className="h-5 w-5" />} />
      <form onSubmit={submit} className="space-y-4 p-5">
        <p className="text-sm text-slate-500">
          {t('feedbackIntro')}
        </p>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('feedbackKind')}</label>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_CATEGORY_KEYS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                  category === item.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t(item.key)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('feedbackMessage')}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            required
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            placeholder={t('feedbackPlaceholder')}
          />
        </div>
        {msg && (
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
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
          {busy ? t('sending') : t('sendToDev')}
        </button>
      </form>
    </Card>
  );
}

/* ---------------- Account panel ---------------- */
function AccountPanel() {
  const { profile, session, signOut } = useAuth();
  const { t, lang } = useLang();
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
      setEmailMsg({ type: 'err', text: t('needEmail') });
      return;
    }
    if (!session?.user?.id) {
      setEmailMsg({ type: 'err', text: t('noLoggedUser') });
      return;
    }
    setEmailBusy(true);
    const { error, applied } = await updateUserAuth({ userId: session.user.id, email: email.trim() });
    setEmailBusy(false);
    if (error) {
      setEmailMsg({ type: 'err', text: localizeError(error, t, lang) });
      return;
    }
    if (!applied) {
      setEmailMsg({ type: 'err', text: t('emailNotApplied') });
      return;
    }
    setEmailMsg({ type: 'ok', text: t('emailUpdated') });
    setTimeout(() => signOut(), 2500);
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg(null);
    if (newPass.length < 6) {
      setPassMsg({ type: 'err', text: t('passwordMin') });
      return;
    }
    if (!session?.user?.id) {
      setPassMsg({ type: 'err', text: t('noLoggedUser') });
      return;
    }
    setPassBusy(true);
    const { error } = await updateUserAuth({ userId: session.user.id, password: newPass });
    setPassBusy(false);
    if (error) {
      setPassMsg({ type: 'err', text: localizeError(error, t, lang) });
    } else {
      setPassMsg({ type: 'ok', text: t('passwordUpdated') });
      setNewPass('');
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle title={t('updateEmailTitle')} icon={<Mail className="h-5 w-5" />} />
        <form onSubmit={updateEmail} className="space-y-4 p-5">
          <p className="text-xs text-slate-400">{t('emailImmediate')}</p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('emailAddress')}</label>
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
            {t('updateEmail')}
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle title={t('changePasswordTitle')} icon={<KeyRound className="h-5 w-5" />} />
        <form onSubmit={updatePassword} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('newPassword')}</label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
              placeholder={t('passwordPlaceholder')}
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
            {t('updatePassword')}
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle title={t('signOutTitle')} icon={<LogOut className="h-5 w-5" />} />
        <div className="p-5">
          <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 font-bold text-white transition hover:bg-rose-600">
            <LogOut className="h-5 w-5" />
            {t('signOutAccount')}
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
