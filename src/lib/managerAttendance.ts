import { supabase } from '@/lib/supabase';

async function callAttendanceAdmin(payload: Record<string, unknown>): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  if (!token || !base) return { error: 'יש להתחבר מחדש.' };

  const body = JSON.stringify({ action: 'manage-attendance', ...payload });
  try {
    const res = await fetch(`${base}/functions/v1/update-employee-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) return { error: null };
    if (json?.error && !/missing userid|nothing to update|missing required/i.test(String(json.error))) {
      return { error: String(json.error) };
    }
  } catch {
    /* fall through */
  }
  return { error: 'fn' };
}

export async function managerInsertAttendance(payload: {
  userId: string;
  clockIn: string;
  clockOut: string | null;
}): Promise<{ error: string | null }> {
  const viaFn = await callAttendanceAdmin({
    op: 'insert',
    employeeId: payload.userId,
    clockIn: payload.clockIn,
    clockOut: payload.clockOut,
  });
  if (!viaFn.error) return { error: null };

  const { error: rpcError } = await supabase.rpc('manager_insert_attendance', {
    p_user_id: payload.userId,
    p_clock_in: payload.clockIn,
    p_clock_out: payload.clockOut,
  });
  if (!rpcError) return { error: null };

  const { error } = await supabase.from('attendance').insert({
    user_id: payload.userId,
    clock_in: payload.clockIn,
    clock_out: payload.clockOut,
    lat: null,
    lng: null,
    location_verified: false,
    qr_verified: false,
    note: 'נוסף ידנית על ידי מנהל',
    status: 'approved',
  });
  if (!error) return { error: null };
  return {
    error:
      'לא ניתן להוסיף דיווח (חסרה הרשאה בשרת). אפשר לערוך דיווח קיים, או לאשר בקשת התאמת שעות ליום שבו כבר יש כניסה.',
  };
}

export async function managerDeleteAttendance(id: string): Promise<{ error: string | null }> {
  const viaFn = await callAttendanceAdmin({ op: 'delete', id });
  if (!viaFn.error) return { error: null };

  const { error: rpcError } = await supabase.rpc('manager_delete_attendance', { p_id: id });
  if (!rpcError) return { error: null };

  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) {
    return { error: 'לא ניתן למחוק את הדיווח. למנהל אין כרגע הרשאת מחיקה בשרת על דיווחי עובדים.' };
  }
  const { data: still } = await supabase.from('attendance').select('id').eq('id', id).maybeSingle();
  if (still) {
    return { error: 'הדיווח לא נמחק. למנהל אין הרשאת מחיקה על דיווחי עובדים בשרת.' };
  }
  return { error: null };
}
