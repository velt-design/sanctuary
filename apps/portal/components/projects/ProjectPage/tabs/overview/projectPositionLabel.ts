import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';
import type { ProjectWorkProjection } from '@/lib/projects/workItems/types';
import { projectOperationalStatusLabel } from '@/lib/projects/projectCurrentStatus';

/** Labels saved facts only; it does not infer payment or installation readiness. */
export function projectPositionLabel(stage: string, state: ProjectWorkProjection['effectiveState'], design: ProjectCommandCentreCurrentDesign, outcome?: ProjectWorkProjection['closedOutcome']): string {
  const operationalLabel = projectOperationalStatusLabel(state, outcome);
  if (operationalLabel) return operationalLabel;
  if (stage === 'paid') return 'Recorded as paid';
  if (stage === 'completed') return 'Recorded as completed';
  if (stage === 'scheduled') return 'Installation scheduled';
  if (design.source === 'accepted_quote') return 'Quote accepted';
  if (design.source === 'sent_quote') return 'Quote sent · decision outstanding';
  if (stage === 'new') return 'New enquiry';
  if (stage === 'contacted') return 'Customer contacted';
  if (stage === 'site_visit') return 'Site visit';
  if (stage === 'quoting') return 'Preparing the quote';
  return 'Current project position';
}
