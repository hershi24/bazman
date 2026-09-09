import { supabase } from '@/lib/supabase';

export const FEEDBACK_CATEGORIES = ['הצעה', 'הערה', 'תקלה', 'אחר'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const DEVELOPER_FEEDBACK_TYPE = 'הצעה למפתח';

export function isDeveloperFeedbackType(type: string | null | undefined): boolean {
  return (type ?? '').trim() === DEVELOPER_FEEDBACK_TYPE;
}

export type DeveloperFeedbackPayload = {
  category: FeedbackCategory | string;
  message: string;
};

type SenderIdentity = {
  senderName: string;
  senderEmail: string | null;
  employeeNumber: string | null;
};

async function currentSender(): Promise<SenderIdentity | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, employee_number')
    .eq('id', user.id)
    .maybeSingle();
  return {
    senderName: (profile?.full_name || '').trim() || 'עובד',
    senderEmail: (user.email || '').trim() || null,
    employeeNumber: (profile?.employee_number || '').trim() || null,
  };
}

function feedbackDescription(payload: DeveloperFeedbackPayload, sender: SenderIdentity): string {
  return [
    `סוג: ${payload.category}`,
    `שם: ${sender.senderName}`,
    `מספר עובד: ${sender.employeeNumber || '—'}`,
    `אימייל: ${sender.senderEmail || '—'}`,
    '',
    payload.message.trim(),
  ].join('\n');
}

async function saveFeedbackRow(payload: DeveloperFeedbackPayload, sender: SenderIdentity): Promise<boolean> {
  const { error } = await supabase.from('developer_feedback').insert({
    category: payload.category,
    message: payload.message.trim(),
    sender_name: sender.senderName,
    sender_email: sender.senderEmail,
    employee_number: sender.employeeNumber,
  });
  return !error;
}

async function saveAsRequest(payload: DeveloperFeedbackPayload, sender: SenderIdentity): Promise<boolean> {
  const { error } = await supabase.from('requests').insert({
    type: DEVELOPER_FEEDBACK_TYPE,
    description: feedbackDescription(payload, sender),
    requested_date: null,
    status: 'pending',
  });
  return !error;
}

async function sendViaEdgeFunction(payload: DeveloperFeedbackPayload): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!token || !base) return false;
  try {
    const res = await fetch(`${base}/functions/v1/send-developer-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify({
        category: payload.category,
        message: payload.message.trim(),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean };
    return res.ok && json?.success === true;
  } catch {
    return false;
  }
}

export async function sendDeveloperFeedback(
  payload: DeveloperFeedbackPayload,
): Promise<{ error: string | null }> {
  const message = payload.message.trim();
  if (message.length < 8) {
    return { error: 'נא לכתוב הודעה קצת יותר מפורטת (לפחות 8 תווים).' };
  }

  const clean = { category: payload.category, message };
  if (await sendViaEdgeFunction(clean)) return { error: null };

  const sender = await currentSender();
  if (!sender) return { error: 'יש להתחבר מחדש ואז לנסות שוב.' };

  const savedRequest = await saveAsRequest(clean, sender);
  const savedRow = await saveFeedbackRow(clean, sender);
  if (savedRequest || savedRow) return { error: null };

  return { error: 'לא ניתן לשלוח כרגע. נסו שוב בעוד כמה דקות.' };
}
