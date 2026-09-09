import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const DEVELOPER_EMAIL = Deno.env.get('DEVELOPER_EMAIL') || 'e0583296967@gmail.com';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function resendApiKey(): string {
  return (
    Deno.env.get('RESEND_API_KEY') ||
    Deno.env.get('SMTP_PASS') ||
    Deno.env.get('SMTP_PASSWORD') ||
    ''
  ).trim();
}

function resendFromAddresses(): string[] {
  const configured = (
    Deno.env.get('RESEND_FROM') ||
    Deno.env.get('MAIL_FROM') ||
    Deno.env.get('SMTP_ADMIN_EMAIL') ||
    Deno.env.get('SMTP_SENDER') ||
    ''
  ).trim();
  return [...new Set(
    [
      configured,
      'BeZman <noreply@bezman.co.il>',
      'BeZman <manager@bezman.co.il>',
      'BeZman <onboarding@resend.dev>',
    ].filter(Boolean),
  )];
}

async function sendViaResend(subject: string, html: string, replyTo?: string | null) {
  const apiKey = resendApiKey();
  if (!apiKey) return false;
  for (const from of resendFromAddresses()) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [DEVELOPER_EMAIL],
        subject,
        html,
        reply_to: replyTo || undefined,
      }),
    });
    if (res.ok) return true;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const message = String(body.message ?? '').trim();
    const category = String(body.category ?? 'הערה').trim() || 'הערה';
    if (message.length < 8) {
      return json({ error: 'נא לכתוב הודעה קצת יותר מפורטת.' }, 400);
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, employee_number')
      .eq('id', userData.user.id)
      .maybeSingle();

    const senderName = (profile?.full_name || '').trim() || 'עובד';
    const senderEmail = (userData.user.email || '').trim() || null;
    const employeeNumber = (profile?.employee_number || '').trim() || null;

    const { error: insertError } = await adminClient.from('developer_feedback').insert({
      user_id: userData.user.id,
      category,
      message,
      sender_name: senderName,
      sender_email: senderEmail,
      employee_number: employeeNumber,
    });

    const { error: requestError } = await adminClient.from('requests').insert({
      user_id: userData.user.id,
      type: 'הצעה למפתח',
      description: [
        `סוג: ${category}`,
        `שם: ${senderName}`,
        `מספר עובד: ${employeeNumber || '—'}`,
        `אימייל: ${senderEmail || '—'}`,
        '',
        message,
      ].join('\n'),
      requested_date: null,
      status: 'pending',
    });

    const subject = `BeZman — ${category} מ${senderName}`;
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>הודעה חדשה מ-BeZman</h2>
        <p><b>סוג:</b> ${escapeHtml(category)}</p>
        <p><b>שם העובד:</b> ${escapeHtml(senderName)}</p>
        <p><b>מספר עובד:</b> ${escapeHtml(employeeNumber || '—')}</p>
        <p><b>אימייל התחברות:</b> ${escapeHtml(senderEmail || '—')}</p>
        <p><b>הודעה:</b></p>
        <pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px">${escapeHtml(message)}</pre>
      </div>
    `;

    const emailed = await sendViaResend(subject, html, senderEmail).catch(() => false);

    if (!emailed && insertError && requestError) {
      return json({ error: requestError.message || insertError.message || 'שליחת ההודעה נכשלה.' }, 500);
    }

    return json({ success: true, emailed });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'שליחת ההודעה נכשלה.' }, 500);
  }
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
