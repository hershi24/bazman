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
