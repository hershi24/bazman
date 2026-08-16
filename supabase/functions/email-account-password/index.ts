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

function randomPassword() {
  const n = crypto.getRandomValues(new Uint32Array(2));
  return `Bz${(n[0] % 1000000).toString().padStart(6, '0')}`;
}

async function sendPasswordEmail(to: string, password: string) {
  const subject = 'הסיסמה שלך במערכת BeZman';
  const text = `שלום,\n\nהסיסמה לכניסה למערכת BeZman עבור ${to} היא:\n\n${password}\n\nאם לא ביקשת איפוס סיסמה, פנה למנהל המערכת.`;
  const html = `<p>שלום,</p><p>הסיסמה לכניסה למערכת <strong>BeZman</strong> עבור ${to} היא:</p><p style="font-size:20px;font-weight:700;letter-spacing:1px">${password}</p><p>אם לא ביקשת איפוס סיסמה, פנה למנהל המערכת.</p>`;

  const errors: string[] = [];
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (resendKey) {
    const from = Deno.env.get('MAIL_FROM') || 'BeZman <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (res.ok) return;
    errors.push(`Resend: ${await res.text()}`);
  }

  const fs = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: subject,
      _template: 'box',
      _captcha: 'false',
      message: text,
    }),
  });
  if (fs.ok) return;
  errors.push(`FormSubmit: ${await fs.text()}`);
  throw new Error(errors.join(' | ') || 'שליחת המייל נכשלה');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'נא להזין אימייל.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      return new Response(JSON.stringify({ error: listErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = list?.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (!user) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const password = randomPassword();
    await sendPasswordEmail(email, password);

    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
