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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function sendMail(to: string, subject: string, text: string, html: string) {
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
    const redirectTo = String(body.redirectTo ?? '').trim() || SUPABASE_URL.replace('.supabase.co', '');
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'נא להזין אימייל.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (email === DEVELOPER_EMAIL) {
      return new Response(JSON.stringify({ success: true }), {
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

    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: linkErr?.message ?? 'לא הצלחנו ליצור קישור איפוס.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const actionLink = linkData.properties.action_link;
    const subject = 'איפוס סיסמה במערכת BeZman';
    const text = `שלום,\n\nלחץ על הקישור כדי לבחור סיסמה חדשה למערכת BeZman:\n\n${actionLink}\n\nאם לא ביקשת איפוס סיסמה, אפשר להתעלם מהמייל.`;
    const html = `<p>שלום,</p><p>לחץ על הכפתור כדי לבחור סיסמה חדשה במערכת <strong>BeZman</strong>:</p><p><a href="${actionLink}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">איפוס סיסמה</a></p><p style="font-size:12px;color:#64748b">אם הכפתור לא עובד, העתק את הקישור:<br>${actionLink}</p>`;

    try {
      await sendMail(email, subject, text, html);
    } catch {
      const recover = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, redirect_to: redirectTo }),
      });
      if (!recover.ok) {
        return new Response(JSON.stringify({ error: 'לא הצלחנו לשלוח את המייל. בדוק ספאם או הגדר SMTP ב-Supabase.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
