import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const DEVELOPER_EMAIL = 'e0583296967@gmail.com';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
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
      .single();

    if (!profile || profile.role !== 'manager') {
      return new Response(JSON.stringify({ error: 'Only managers can update credentials' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { userId, email, password } = body as { userId: string; email?: string; password?: string };

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
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

    const targetEmail = (targetUser.user.email ?? '').toLowerCase();
    if (targetEmail === DEVELOPER_EMAIL) {
      return new Response(JSON.stringify({ error: 'Cannot modify the developer account' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nextEmail = email?.trim().toLowerCase();
    if (nextEmail === DEVELOPER_EMAIL) {
      return new Response(JSON.stringify({ error: 'Cannot assign the developer email' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const update: { email?: string; password?: string; email_confirm?: boolean } = {};
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

    const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, update);

    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: after } = await adminClient.auth.admin.getUserById(userId);
    const actualEmail = (after.user?.email ?? '').toLowerCase();
    const applied = !nextEmail || actualEmail === nextEmail;

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
