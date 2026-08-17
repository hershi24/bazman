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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function randomPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = 'Bz-';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

function fetchWithTimeout(url: string, init: RequestInit, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function looksLikeChallenge(text: string) {
  return /just a moment|cf-mitigated|cloudflare|attention required/i.test(text);
}

function parseMailError(provider: string, res: Response, text: string) {
  if (looksLikeChallenge(text)) return `${provider}: blocked by Cloudflare`;
  try {
    const body = JSON.parse(text) as {
      success?: boolean | string;
      error?: unknown;
      message?: string;
      errors?: unknown;
    };
    if (body.success === false || body.success === 'false') {
      return `${provider}: ${body.message || 'rejected'}`;
    }
    if (body.error || body.errors) {
      return `${provider}: ${JSON.stringify(body.error || body.errors)}`;
    }
  } catch {
    // not JSON
  }
  if (!res.ok) return `${provider}: ${res.status} ${text.slice(0, 300)}`;
  return null;
}

async function sendWithResend(to: string, subject: string, text: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return 'Resend: missing RESEND_API_KEY';
  const from = Deno.env.get('MAIL_FROM') || 'BeZman <onboarding@resend.dev>';
  const res = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const body = await res.text();
  return parseMailError('Resend', res, body);
}

async function sendWithBrevo(to: string, subject: string, text: string, html: string) {
  const key = Deno.env.get('BREVO_API_KEY');
  if (!key) return 'Brevo: missing BREVO_API_KEY';
  const fromEmail = Deno.env.get('MAIL_FROM_EMAIL') || 'noreply@bezman.co.il';
  const fromName = Deno.env.get('MAIL_FROM_NAME') || 'BeZman';
  const res = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  const body = await res.text();
  return parseMailError('Brevo', res, body);
}

async function sendWithSendGrid(to: string, subject: string, text: string, html: string) {
  const key = Deno.env.get('SENDGRID_API_KEY');
  if (!key) return 'SendGrid: missing SENDGRID_API_KEY';
  const from = Deno.env.get('MAIL_FROM_EMAIL') || 'noreply@bezman.co.il';
  const res = await fetchWithTimeout('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: 'BeZman' },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });
  const body = await res.text();
  if (res.status === 202) return null;
  return parseMailError('SendGrid', res, body);
}

async function sendPasswordEmail(to: string, password: string) {
  const subject = 'הסיסמה שלך במערכת BeZman';
  const text =
    `שלום,\n\nהסיסמה החדשה לכניסה למערכת BeZman עבור ${to} היא:\n\n${password}\n\n` +
    'אפשר להתחבר איתה מיד. אם לא ביקשת איפוס סיסמה, פנה למנהל המערכת.';
  const html =
    `<p>שלום,</p><p>הסיסמה החדשה לכניסה למערכת <strong>BeZman</strong> עבור ${to} היא:</p>` +
    `<p style="font-size:22px;font-weight:700;letter-spacing:1px;font-family:ui-monospace,monospace">${password}</p>` +
    '<p>אפשר להתחבר איתה מיד. אם לא ביקשת איפוס סיסמה, פנה למנהל המערכת.</p>';

  const errors: string[] = [];
  for (const sender of [sendWithResend, sendWithBrevo, sendWithSendGrid]) {
    try {
      const err = await sender(to, subject, text, html);
      if (!err) return;
      if (!/missing /i.test(err)) errors.push(err);
    } catch (err) {
      errors.push(String(err));
    }
  }

  throw new Error(
    errors[0] ||
      'אין שירות מייל מוגדר. הוסף RESEND_API_KEY (או BREVO_API_KEY / SENDGRID_API_KEY) לפונקציה email-account-password.',
  );
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return json({ error: 'נא להזין אימייל.' }, 400);
    }

    const user = await findAuthUser(email);
    if (!user) {
      return json({ success: true });
    }

    const password = randomPassword();
    await sendPasswordEmail(email, password);

    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (updateErr) {
      return json({ error: updateErr.message }, 400);
    }

    await admin.from('profiles').update({ login_password: password }).eq('id', user.id);

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
