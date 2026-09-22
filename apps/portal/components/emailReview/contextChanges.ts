import type { EmailReviewProjectContext } from '@/lib/emailReview/contracts';

export function contextChanges(saved: EmailReviewProjectContext, current: EmailReviewProjectContext): string[] {
  const changes: string[] = [];
  const display = (value: string | null) => value || 'Not recorded';
  const fields = [
    ['name', 'Project name'], ['stage', 'Project stage'], ['state', 'Work state'],
    ['contactName', 'Contact name'], ['contactEmail', 'Contact email'],
  ] as const;
  for (const [field, label] of fields) {
    if (saved[field] !== current[field]) changes.push(`${label}: ${display(saved[field])} → ${display(current[field])}`);
  }
  if (saved.contactId !== current.contactId) changes.push('Contact assignment changed. Check the current contact on the project before continuing.');
  if (saved.archivedAt !== current.archivedAt) {
    changes.push(`Archive status: ${saved.archivedAt ? `Archived on ${new Date(saved.archivedAt).toLocaleString()}` : 'Not archived'} → ${current.archivedAt ? `Archived on ${new Date(current.archivedAt).toLocaleString()}` : 'Not archived'}`);
  }
  if (saved.stateVersion !== current.stateVersion) {
    changes.push(`Project work state was updated (revision ${saved.stateVersion ?? 'not recorded'} → ${current.stateVersion ?? 'not recorded'}). Review the latest project notes even if its stage and state labels are unchanged.`);
  }
  return changes;
}
