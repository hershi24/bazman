import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PRIMARY = {
  email: 'e0583296967@gmail.com',
    password: '860640',
  fullName: 'מנהל ראשי',
  role: 'manager' as const,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing?.users?.find((x) => x.email === PRIMARY.email);

    let userId: string;

    if (found) {
      const { data, error } = await admin.auth.admin.updateUserById(found.id, {
        password: PRIMARY.password,
        email_confirm: true,
        user_metadata: { full_name: PRIMARY.fullName, role: PRIMARY.role },
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: PRIMARY.email,
        password: PRIMARY.password,
        email_confirm: true,
        user_metadata: { full_name: PRIMARY.fullName, role: PRIMARY.role },
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = data.user.id;
    }

    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: userId,
        role: PRIMARY.role,
        full_name: PRIMARY.fullName,
        employee_number: null,
        department_id: null,
        phone: null,
        status: 'active',
        hidden: true,
      },
      { onConflict: 'id' },
    );

    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
