import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';

type SupabaseLikeError = { code?: unknown; message?: unknown };

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function isMissingNextActionColumnError(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code).trim();
  const msg = toStr(e?.message).toLowerCase();
  return code === 'PGRST204' || code === '42703' || msg.includes('does not exist') || msg.includes('missing') || msg.includes('undefined column');
}

function missingColumnFromError(error: unknown): string | null {
  const msg = toStr((error as SupabaseLikeError)?.message);
  const match = msg.match(/'([^']+)' column/i);
  return match ? match[1] : null;
}

export async function updateDashboardNextActionWithFallback(projectUuid: string, payloadIn: Record<string, any>) {
  const supabase = await getSupabaseServerAuth();
  let payload = { ...payloadIn };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (!Object.keys(payload).length) {
      throw new Error('No supported next-action fields found in the projects table.');
    }

    const { error } = await supabase.from('projects').update(payload).eq('id', projectUuid);
    if (!error) return;

    if (!isMissingNextActionColumnError(error)) throw error;

    const missing = missingColumnFromError(error);
    if (missing && missing in payload) {
      delete payload[missing];
      continue;
    }

    if ('next_action' in payload) {
      delete payload.next_action;
      continue;
    }
    if ('next_action_type' in payload) {
      delete payload.next_action_type;
      continue;
    }
    if ('next_action_at' in payload) {
      delete payload.next_action_at;
      continue;
    }
    if ('next_action_date' in payload) {
      delete payload.next_action_date;
      continue;
    }
    if ('follow_up_date' in payload) {
      delete payload.follow_up_date;
      continue;
    }
    if ('last_activity_at' in payload) {
      delete payload.last_activity_at;
      continue;
    }

    throw error;
  }
}

export async function insertDashboardNextActionNoteAudit(input: {
  projectUuid: string;
  actionLabel: string;
  dueDate: string;
  note: string;
}) {
  const supabase = await getSupabaseServerAuth();
  const now = new Date().toISOString();

  await supabase.from('audit_events').insert({
    project_id: input.projectUuid,
    type: 'dashboard.next_action_note',
    idempotency_key: `next_action_note:${input.projectUuid}:${Date.now()}`,
    payload: {
      note: input.note,
      actionLabel: input.actionLabel,
      dueDate: input.dueDate,
    },
    created_at: now,
  } as any);
}
