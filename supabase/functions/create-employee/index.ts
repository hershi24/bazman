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

    const callerEmail = (userData.user.email ?? '').toLowerCase();
    const isCallerManager =
      profile?.role === 'manager' ||
      callerEmail === DEVELOPER_EMAIL ||
      userData.user.user_metadata?.role === 'manager';

    if (!isCallerManager) {
      return new Response(JSON.stringify({ error: 'Only managers can add users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    if (body?.action === 'apply-hours') {
      const employeeId = String(body.employeeId ?? '');
      const date = String(body.date ?? '').slice(0, 10);
      const clockIn = body.clockIn ? String(body.clockIn) : null;
      const clockOut = body.clockOut ? String(body.clockOut) : null;
      if (!employeeId || !date || (!clockIn && !clockOut)) {
        return new Response(JSON.stringify({ error: 'Missing hours fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const dateKey = (iso: string | null | undefined) => {
        if (!iso) return '';
        if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const toIso = (time: string) => {
        const [hh, mm] = time.split(':');
        return new Date(`${date}T${String(Number(hh)).padStart(2, '0')}:${String(Number(mm)).padStart(2, '0')}:00+03:00`).toISOString();
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
      } else if (clockIn) {
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
      } else {
        return new Response(JSON.stringify({ error: 'אין דיווח ביום זה ואין שעת כניסה.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, password, full_name, employee_number, department_id, phone, role: rawRole } = body;
    const role = rawRole === 'manager' ? 'manager' : 'employee';

    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (String(password).length < 6) {
      return new Response(JSON.stringify({ error: 'Password should be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: String(email).trim(),
      password: String(password),
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;

    // Insert the profile row
    const { error: profileErr } = await adminClient.from('profiles').insert({
      id: userId,
      role,
      full_name,
      employee_number: role === 'manager' ? null : employee_number || null,
      department_id: role === 'manager' ? null : department_id || null,
      phone: phone || null,
      status: 'active',
      hidden: false,
    });

    if (profileErr) {
      // Best-effort cleanup: delete the auth user if profile insert failed
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ id: userId, email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
