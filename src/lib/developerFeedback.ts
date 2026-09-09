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
  senderName: string;
  senderEmail: string | null;
  employeeNumber: string | null;
};

function feedbackDescription(payload: DeveloperFeedbackPayload): string {
  return [
    `סוג: ${payload.category}`,
    `שם: ${payload.senderName}`,
    `מספר עובד: ${payload.employeeNumber || '—'}`,
    `אימייל: ${payload.senderEmail || '—'}`,
    '',
    payload.message.trim(),
  ].join('\n');
}

async function saveFeedbackRow(payload: DeveloperFeedbackPayload): Promise<boolean> {
  const { error } = await supabase.from('developer_feedback').insert({
    category: payload.category,
    message: payload.message,
    sender_name: payload.senderName,
    sender_email: payload.senderEmail,
    employee_number: payload.employeeNumber,
  });
  return !error;
}

async function saveAsRequest(payload: DeveloperFeedbackPayload): Promise<boolean> {
  const { error } = await supabase.from('requests').insert({
    type: DEVELOPER_FEEDBACK_TYPE,
    description: feedbackDescription(payload),
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
      body: JSON.stringify(payload),
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

  if (await sendViaEdgeFunction(payload)) return { error: null };

  const savedRequest = await saveAsRequest(payload);
  const savedRow = await saveFeedbackRow(payload);
  if (savedRequest || savedRow) return { error: null };

  return { error: 'לא ניתן לשלוח כרגע. נסו שוב בעוד כמה דקות.' };
}
