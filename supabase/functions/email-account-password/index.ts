import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fetchWithTimeout(url: string, init: RequestInit, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function findAuthUser(email: string) {
  const adminApi = admin.auth.admin as typeof admin.auth.admin & {
    getUserByEmail?: (value: string) => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: { message: string } | null;
    }>;
  };
  if (typeof adminApi.getUserByEmail === 'function') {
    const { data, error } = await adminApi.getUserByEmail(email);
    if (!error && data?.user) return data.user;
  }

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const user = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 200) break;
  }
  return null;
}

async function sendRecoveryViaSmtp(email: string, redirectTo: string) {
  const body: Record<string, string> = { email };
  if (redirectTo) body.redirect_to = redirectTo;

  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || 'שליחת מייל האיפוס דרך SMTP נכשלה.');
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const redirectTo = String(body.redirectTo ?? '').trim();
    if (!email || !email.includes('@')) {
      return json({ error: 'נא להזין אימייל.' }, 400);
    }

    const user = await findAuthUser(email);
    if (!user) {
      return json({ success: true });
    }

    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    await sendRecoveryViaSmtp(email, redirectTo);
    return json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const aborted = /abort/i.test(message);
    return json(
      {
        error: aborted
          ? 'שליחת המייל ארכה יותר מדי. נסה שוב.'
          : message || 'שליחת המייל נכשלה.',
      },
      500,
    );
  }
});
