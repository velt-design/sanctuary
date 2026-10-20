import { PIPELINE_STAGE_LABELS, type PipelineStageKey } from './pipelineDefinition';
import type { ProjectCommandCentreResponse } from './commandCentre/types';
import type { ProjectPageSnapshot } from './types';
import { projectClosedOutcomeLabel } from './workItems/presentation';
import type { ProjectWorkProjection } from './workItems/types';

export type ProjectStatusFacts = {
  workModel: 'legacy' | 'v2' | 'unknown';
  effectiveState: ProjectWorkProjection['effectiveState'] | null;
  closedOutcome: ProjectWorkProjection['closedOutcome'];
};

/** Operational state overrides historical progress, without rewriting that progress. */
export function projectOperationalStatusLabel(
  state: ProjectStatusFacts['effectiveState'],
  outcome?: ProjectStatusFacts['closedOutcome'],
): string | null {
  if (state === 'ARCHIVED') return 'Archived';
  if (state === 'CLOSED') return outcome ? `Closed · ${projectClosedOutcomeLabel(outcome)}` : 'Closed';
  if (state === 'WAITING') return 'On hold';
  return null;
}

export function projectCurrentStatus(
  stage: PipelineStageKey,
  facts: ProjectStatusFacts | null | undefined,
  pending = false,
) {
  const operationalLabel = projectOperationalStatusLabel(facts?.effectiveState ?? null, facts?.closedOutcome);
  if (operationalLabel) return { label: operationalLabel, stage: null, state: facts!.effectiveState };
  if (facts?.effectiveState === 'ACTIVE' || facts?.workModel === 'legacy') {
    return { label: PIPELINE_STAGE_LABELS[stage], stage, state: facts.effectiveState };
  }
  return { label: pending ? 'Updating status…' : 'Status unavailable', stage: null, state: null };
}

/** Snapshot and Overview share existing reads; an older response must not undo newer state. */
export function currentProjectWork(
  snapshot: ProjectPageSnapshot,
  command?: ProjectCommandCentreResponse,
): ProjectWorkProjection | undefined {
  if (snapshot.workModel !== 'v2') return undefined;
  const matches = (projection?: ProjectWorkProjection) => projection?.projectId === snapshot.project.id;
  const fromSnapshot = matches(snapshot.projectWork) ? snapshot.projectWork : undefined;
  if (!command || command.projectId !== snapshot.project.id) return fromSnapshot;
  if (command.workModel !== 'v2') return undefined;
  const fromCommand = matches(command.projectWork) ? command.projectWork : undefined;
  if (!fromSnapshot || !fromCommand) return fromCommand ?? fromSnapshot;
  // State revisions guard against a delayed response; timestamps also cover archive changes.
  if (fromSnapshot.stateRowVersion !== fromCommand.stateRowVersion) {
    return fromSnapshot.stateRowVersion > fromCommand.stateRowVersion ? fromSnapshot : fromCommand;
  }
  return Date.parse(fromSnapshot.generatedAt) > Date.parse(fromCommand.generatedAt) ? fromSnapshot : fromCommand;
}
