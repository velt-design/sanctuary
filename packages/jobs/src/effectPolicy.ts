import type { BackgroundJobEffectState, BackgroundJobKind } from './contracts';
import { getBackgroundJobDefinition } from './registry';

export type BackgroundJobEffectCheckpointSnapshot = Readonly<{
  effectKind: string;
  state: BackgroundJobEffectState;
  providerIdempotencyExpiresAt: string | null;
}>;

export function getMissingBackgroundJobEffectCheckpoints(
  kind: BackgroundJobKind,
  effects: readonly BackgroundJobEffectCheckpointSnapshot[],
): string[] {
  const finalisedKinds = new Set(
    effects.filter((effect) => effect.state === 'finalised').map((effect) => effect.effectKind),
  );
  return getBackgroundJobDefinition(kind).requiredEffectCheckpoints.filter(
    (effectKind) => !finalisedKinds.has(effectKind),
  );
}

export function backgroundJobEffectCheckpointsComplete(
  kind: BackgroundJobKind,
  effects: readonly BackgroundJobEffectCheckpointSnapshot[],
): boolean {
  return getMissingBackgroundJobEffectCheckpoints(kind, effects).length === 0;
}
