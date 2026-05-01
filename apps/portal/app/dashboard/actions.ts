'use server';
import { getPortalSession } from '@/lib/auth';
import {
  insertDashboardNextActionNoteAudit,
  isMissingNextActionColumnError,
  updateDashboardNextActionWithFallback,
} from '@/lib/dashboard/nextAction';
import { uuidFromAppId } from '@/lib/supabase/mappers';

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

  await updateDashboardNextActionWithFallback(projectUuid, {
    follow_up_date: dueDate || null,
    next_action_date: dueDate || null,
    next_action_at: nextActionAt,
    next_action_type: actionLabel || null,
    next_action: actionLabel || null,
    last_activity_at: new Date().toISOString(),
  });

  if (input.note && input.note.trim()) {
    try {
      await insertDashboardNextActionNoteAudit({
        projectUuid,
        actionLabel,
        dueDate,
        note: input.note.trim(),
      });
    } catch (err) {
      if (!isMissingNextActionColumnError(err)) {
        // Ignore audit insert errors; next action update already succeeded.
      }
    }
  }

}
