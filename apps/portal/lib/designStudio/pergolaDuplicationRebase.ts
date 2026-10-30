import type { StudioAuthoringEdit } from './authoringView';
import type { StudioPergolaDuplication } from './pergolaDuplication';

/** New copies wait for acknowledgment. Never guess replacement private ancestry. */
export function rebaseStudioDuplications(current: StudioAuthoringEdit, sent: StudioAuthoringEdit): StudioPergolaDuplication[] {
  const acknowledged = new Map((sent.duplications ?? []).map(op => [op.targetId, JSON.stringify(op)]));
  if ((current.duplications ?? []).some(op => acknowledged.get(op.targetId) !== JSON.stringify(op)))
    throw Error('Finish reconciling the saved design before making another copy.');
  return [];
}
