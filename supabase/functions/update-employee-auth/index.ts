import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DEVELOPER_EMAIL = 'e0583296967@gmail.com';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function adminPutUser(userId: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.msg || json.message || json.error_description || json.error || 'Auth update failed');
  }
  return json;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();

    const body = await req.json();
    if (body?.action === 'apply-hours') {
      const employeeId = String(body.employeeId ?? '');
      const date = String(body.date ?? '').slice(0, 10);
      const clockIn = body.clockIn ? String(body.clockIn) : null;
      const clockOut = body.clockOut ? String(body.clockOut) : null;
      const isManager =
        profile?.role === 'manager' ||
        (userData.user.email ?? '').toLowerCase() === DEVELOPER_EMAIL ||
        userData.user.user_metadata?.role === 'manager';
      if (!isManager) {
        return new Response(JSON.stringify({ error: 'Only managers can apply hours' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!employeeId || !date || (!clockIn && !clockOut)) {
        return new Response(JSON.stringify({ error: 'Missing hours fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pad = (n: number) => String(n).padStart(2, '0');
      const dateKey = (iso: string | null | undefined) => {
        if (!iso) return '';
        if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const toIso = (time: string) => {
        const [hh, mm] = time.split(':');
        const h = String(Number(hh)).padStart(2, '0');
        const min = String(Number(mm)).padStart(2, '0');
        return new Date(`${date}T${h}:${min}:00+03:00`).toISOString();
      };

      const attendanceId = body.attendanceId ? String(body.attendanceId) : '';
      const shiftNumber = Number(body.shiftNumber ?? 0);
      const { data: rows } = await adminClient
        .from('attendance')
        .select('id, clock_in, clock_out')
        .eq('user_id', employeeId)
        .order('clock_in', { ascending: true })
        .limit(200);

      const sameDay = (rows ?? []).filter((r: { clock_in: string | null }) => dateKey(r.clock_in) === date);
      const existing =
        (attendanceId ? sameDay.find((r: { id: string }) => r.id === attendanceId) : null) ??
        (shiftNumber >= 1 && shiftNumber <= sameDay.length ? sameDay[shiftNumber - 1] : null) ??
        sameDay[0] ??
        null;
      const patch: Record<string, unknown> = {};
      if (clockIn) patch.clock_in = toIso(clockIn);
      if (clockOut) patch.clock_out = toIso(clockOut);

      if (existing) {
        const { error } = await adminClient.from('attendance').update(patch).eq('id', existing.id);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        if (!clockIn) {
          return new Response(JSON.stringify({ error: 'אין דיווח ביום זה ואין שעת כניסה ליצירת דיווח חדש.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { error } = await adminClient.from('attendance').insert({
          user_id: employeeId,
          clock_in: patch.clock_in,
          clock_out: patch.clock_out ?? null,
          lat: null,
          lng: null,
          location_verified: false,
          qr_verified: false,
          note: 'עודכן מאישור התאמת שעות',
          status: 'approved',
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body?.action === 'manage-attendance') {
      const isManager =
        profile?.role === 'manager' ||
        (userData.user.email ?? '').toLowerCase() === DEVELOPER_EMAIL ||
        userData.user.user_metadata?.role === 'manager';
      if (!isManager) {
        return new Response(JSON.stringify({ error: 'Only managers can manage attendance' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const op = String(body.op ?? '');
      if (op === 'delete') {
        const id = String(body.id ?? '');
        if (!id) {
          return new Response(JSON.stringify({ error: 'Missing id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { error } = await adminClient.from('attendance').delete().eq('id', id);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (op === 'insert') {
        const employeeId = String(body.employeeId ?? '');
        const clockIn = String(body.clockIn ?? '');
        const clockOut = body.clockOut ? String(body.clockOut) : null;
        if (!employeeId || !clockIn) {
          return new Response(JSON.stringify({ error: 'Missing attendance fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { error } = await adminClient.from('attendance').insert({
          user_id: employeeId,
          clock_in: clockIn,
          clock_out: clockOut,
          lat: null,
          lng: null,
          location_verified: false,
          qr_verified: false,
          note: 'נוסף ידנית על ידי מנהל',
          status: 'approved',
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Unknown op' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId, email, password } = body as { userId: string; email?: string; password?: string };

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerEmail = (userData.user.email ?? '').toLowerCase();
    const isSelf = userData.user.id === userId;
    const isManager =
      profile?.role === 'manager' ||
      callerEmail === DEVELOPER_EMAIL ||
      userData.user.user_metadata?.role === 'manager';
    if (!isManager && !isSelf) {
      return new Response(JSON.stringify({ error: 'Only managers can update other users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: targetUser, error: targetErr } = await adminClient.auth.admin.getUserById(userId);
    if (targetErr || !targetUser.user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nextEmail = email?.trim().toLowerCase();

    const update: Record<string, unknown> = {};
    if (nextEmail) {
      update.email = nextEmail;
      update.email_confirm = true;
    }
    if (password && password.trim()) update.password = password.trim();

    if (Object.keys(update).length === 0) {
      return new Response(JSON.stringify({ error: 'Nothing to update' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      await adminPutUser(userId, update);
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (nextEmail) {
      // Confirm again in case the first call only queued an email change.
      try {
        await adminPutUser(userId, { email: nextEmail, email_confirm: true });
      } catch {
        // already applied
      }
    }

    const { data: after } = await adminClient.auth.admin.getUserById(userId);
    let actualEmail = (after.user?.email ?? '').toLowerCase();
    let pendingEmail = String((after.user as { new_email?: string } | undefined)?.new_email ?? '').toLowerCase();
    let applied = !nextEmail || (actualEmail === nextEmail && !pendingEmail);

    if (nextEmail && !applied) {
      try {
        await adminClient.auth.admin.updateUserById(userId, { email: nextEmail, email_confirm: true });
        const { data: retry } = await adminClient.auth.admin.getUserById(userId);
        actualEmail = (retry.user?.email ?? '').toLowerCase();
        pendingEmail = String((retry.user as { new_email?: string } | undefined)?.new_email ?? '').toLowerCase();
        applied = actualEmail === nextEmail && !pendingEmail;
      } catch {
        // keep applied=false
      }
    }

    return new Response(JSON.stringify({ success: true, email: actualEmail || null, applied }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
