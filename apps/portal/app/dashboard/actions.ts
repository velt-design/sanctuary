'use server';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { getPortalSession } from '@/lib/auth';
import { uuidFromAppId } from '@/lib/supabase/mappers';

type SupabaseLikeError = { code?: unknown; message?: unknown };

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isMissingColumnError(error: unknown): boolean {
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

async function updateWithFallback(projectUuid: string, payloadIn: Record<string, any>) {
  const supabase = await getSupabaseServerAuth();
  let payload = { ...payloadIn };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (!Object.keys(payload).length) {
      throw new Error('No supported next-action fields found in the projects table.');
    }
    const { error } = await supabase.from('projects').update(payload).eq('id', projectUuid);
    if (!error) return;

    if (!isMissingColumnError(error)) throw error;

    const missing = missingColumnFromError(error);
    if (missing && missing in payload) {
      delete payload[missing];
      continue;
    }

    // Fallback: drop optional columns in a stable order.
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

export async function setNextAction(input: {
  projectId: string;
  actionLabel: string;
  dueDate: string; // YYYY-MM-DD
  note?: string;
}) {
  const session = await getPortalSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const projectUuid = uuidFromAppId(input.projectId, 'proj');
  const dueDate = input.dueDate.trim();
  const actionLabel = input.actionLabel.trim();
  const nextActionAt = dueDate ? `${dueDate}T00:00:00Z` : null;

  await updateWithFallback(projectUuid, {
    follow_up_date: dueDate || null,
    next_action_date: dueDate || null,
    next_action_at: nextActionAt,
    next_action_type: actionLabel || null,
    next_action: actionLabel || null,
    last_activity_at: new Date().toISOString(),
  });

  if (input.note && input.note.trim()) {
    const supabase = await getSupabaseServerAuth();
    try {
      const now = new Date().toISOString();
      await supabase.from('audit_events').insert({
        project_id: projectUuid,
        type: 'dashboard.next_action_note',
        idempotency_key: `next_action_note:${projectUuid}:${Date.now()}`,
        payload: {
          note: input.note.trim(),
          actionLabel,
          dueDate,
        },
        created_at: now,
      } as any);
    } catch (err) {
      if (!isMissingColumnError(err)) {
        // Ignore audit insert errors; next action update already succeeded.
      }
    }
  }

}
