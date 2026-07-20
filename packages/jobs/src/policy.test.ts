import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_REGISTRY,
  assertBackgroundJobEffectCheckpointsComplete,
  backgroundJobEffectAllowed,
  backgroundJobEffectCheckpointsComplete,
  getBackgroundJobAutomaticRetryDecision,
  getBackgroundJobDefinition,
  getBackgroundJobEffectCompletionIssues,
  getMissingBackgroundJobEffectCheckpoints,
  type BackgroundJobEffectCheckpointSnapshot,
  type BackgroundJobExecutionOwner,
  type BackgroundJobKind,
} from '@sp/jobs';

const NOW_MS = Date.parse('2026-07-20T00:00:00.000Z');

const EXPECTED_ALLOWED_EFFECTS = {
  deposit_invoice_prepare_and_send: ['email_dispatch'],
  quote_send: ['email_dispatch'],
  quote_resend: ['email_dispatch'],
  job_pack_generate: [],
  automation_event: [],
  email_outbox_deliver: ['email_dispatch'],
} as const satisfies Record<BackgroundJobKind, readonly string[]>;

function effect(
  effectKind: string,
  state: BackgroundJobEffectCheckpointSnapshot['state'],
  expiresAtMs: number | null = NOW_MS + 60_000,
): BackgroundJobEffectCheckpointSnapshot {
  return {
    effectKind,
    state,
    providerIdempotencyExpiresAt: expiresAtMs === null ? null : new Date(expiresAtMs).toISOString(),
  };
}

function retryDecision(
  state: BackgroundJobEffectCheckpointSnapshot['state'],
  expiresAtMs: number | null,
  executionOwner: BackgroundJobExecutionOwner = 'worker',
) {
  return getBackgroundJobAutomaticRetryDecision({
    kind: 'quote_send',
    contractVersion: 1,
    attemptNumber: 1,
    elapsedSinceFirstAttemptMs: 0,
    effects: [effect('email_dispatch', state, expiresAtMs)],
    executionOwner,
    nowMs: NOW_MS,
  });
}

describe('background job registry policy', () => {
  it('declares unique allowed effects and keeps every required effect inside that allowlist', () => {
    for (const kind of BACKGROUND_JOB_KINDS) {
      const definition = getBackgroundJobDefinition(kind, 1);
      expect(definition.allowedEffectCheckpoints, kind).toEqual(EXPECTED_ALLOWED_EFFECTS[kind]);
      expect(new Set(definition.allowedEffectCheckpoints).size, kind).toBe(
        definition.allowedEffectCheckpoints.length,
      );
      expect(new Set(definition.requiredEffectCheckpoints).size, kind).toBe(
        definition.requiredEffectCheckpoints.length,
      );
      expect(
        definition.requiredEffectCheckpoints.every((effectKind) =>
          (definition.allowedEffectCheckpoints as readonly string[]).includes(effectKind),
        ),
        kind,
      ).toBe(true);
    }
  });

  it('allows no external checkpoint for every non-side-effecting kind', () => {
    for (const kind of BACKGROUND_JOB_KINDS) {
      const definition = BACKGROUND_JOB_REGISTRY[kind];
      if (definition.hasExternalSideEffect) {
        expect(definition.allowedEffectCheckpoints.length, kind).toBeGreaterThan(0);
      } else {
        expect(definition.allowedEffectCheckpoints, kind).toEqual([]);
        expect(definition.requiredEffectCheckpoints, kind).toEqual([]);
      }
    }

    expect(backgroundJobEffectAllowed('job_pack_generate', 'email_dispatch', 1)).toBe(false);
    expect(backgroundJobEffectAllowed('automation_event', 'email_dispatch', 1)).toBe(false);
    expect(backgroundJobEffectAllowed('quote_send', 'email_dispatch', 1)).toBe(true);
  });

  it('rejects unknown kinds and non-current contract versions at lookup', () => {
    expect(() => getBackgroundJobDefinition('quote_send', 1)).not.toThrow();
    expect(() => getBackgroundJobDefinition('quote_send', 2)).toThrow(/unsupported.*contract version/i);
    expect(() => getBackgroundJobDefinition('quote_send', 1.5)).toThrow(/unsupported.*contract version/i);
    expect(() => getBackgroundJobDefinition('quote_send', Number.NaN)).toThrow(/unsupported.*contract version/i);
    expect(() => getBackgroundJobDefinition('missing_kind' as BackgroundJobKind, 1)).toThrow(
      /unknown background-job kind/i,
    );
  });
});

describe('background job effect completion policy', () => {
  it('accepts exactly one finalised checkpoint for every required and allowed effect', () => {
    const effects = [effect('email_dispatch', 'finalised', null)];
    expect(backgroundJobEffectCheckpointsComplete('quote_send', effects, 1)).toBe(true);
    expect(getBackgroundJobEffectCompletionIssues('quote_send', effects, 1)).toEqual([]);
    expect(() => assertBackgroundJobEffectCheckpointsComplete('quote_send', effects, 1)).not.toThrow();
  });

  it.each([
    'prepared',
    'dispatch_started',
    'provider_accepted',
    'uncertain',
    'failed',
  ] as const)('rejects a recorded required effect in the %s state', (state) => {
    const effects = [effect('email_dispatch', state)];
    expect(backgroundJobEffectCheckpointsComplete('quote_send', effects, 1)).toBe(false);
    expect(getBackgroundJobEffectCompletionIssues('quote_send', effects, 1)).toContainEqual({
      reason: 'effect_not_finalised',
      effectKind: 'email_dispatch',
      state,
    });
  });

  it('rejects undeclared effects even when they are finalised', () => {
    const effects = [effect('storage_upload', 'finalised', null)];
    expect(backgroundJobEffectCheckpointsComplete('quote_send', effects, 1)).toBe(false);
    expect(getBackgroundJobEffectCompletionIssues('quote_send', effects, 1)).toContainEqual({
      reason: 'undeclared_effect',
      effectKind: 'storage_upload',
    });
  });

  it('rejects all recorded effects for non-side-effecting jobs', () => {
    const effects = [effect('email_dispatch', 'finalised', null)];
    expect(backgroundJobEffectCheckpointsComplete('job_pack_generate', effects, 1)).toBe(false);
    expect(backgroundJobEffectCheckpointsComplete('automation_event', effects, 1)).toBe(false);
    expect(backgroundJobEffectCheckpointsComplete('job_pack_generate', [], 1)).toBe(true);
    expect(backgroundJobEffectCheckpointsComplete('automation_event', [], 1)).toBe(true);
  });

  it('rejects duplicate effect kinds so another key cannot mask unfinished work', () => {
    const finalisedThenPrepared = [
      effect('email_dispatch', 'finalised', null),
      effect('email_dispatch', 'prepared'),
    ];
    expect(backgroundJobEffectCheckpointsComplete('quote_send', finalisedThenPrepared, 1)).toBe(false);
    expect(getBackgroundJobEffectCompletionIssues('quote_send', finalisedThenPrepared, 1)).toEqual(
      expect.arrayContaining([
        { reason: 'duplicate_effect_kind', effectKind: 'email_dispatch' },
        { reason: 'effect_not_finalised', effectKind: 'email_dispatch', state: 'prepared' },
      ]),
    );

    const duplicateFinalised = [
      effect('email_dispatch', 'finalised', null),
      effect('email_dispatch', 'finalised', null),
    ];
    expect(backgroundJobEffectCheckpointsComplete('quote_send', duplicateFinalised, 1)).toBe(false);
    expect(() => assertBackgroundJobEffectCheckpointsComplete('quote_send', duplicateFinalised, 1)).toThrow(
      /duplicate_effect_kind:email_dispatch/i,
    );
  });

  it('rejects completion when a required effect is absent', () => {
    expect(backgroundJobEffectCheckpointsComplete('quote_send', [], 1)).toBe(false);
    expect(getBackgroundJobEffectCompletionIssues('quote_send', [], 1)).toEqual([
      { reason: 'missing_required_effect', effectKind: 'email_dispatch' },
    ]);
  });

  it('allows shadow completion with only declared unique prepared effects', () => {
    const effects = [effect('email_dispatch', 'prepared', null)];
    expect(backgroundJobEffectCheckpointsComplete('quote_send', effects, 1, 'shadow')).toBe(true);
    expect(getBackgroundJobEffectCompletionIssues('quote_send', effects, 1, 'shadow')).toEqual([]);
    expect(getMissingBackgroundJobEffectCheckpoints('quote_send', effects, 1, 'shadow')).toEqual([]);
    expect(backgroundJobEffectCheckpointsComplete('quote_send', [], 1, 'shadow')).toBe(true);
    expect(() =>
      assertBackgroundJobEffectCheckpointsComplete('quote_send', effects, 1, 'shadow'),
    ).not.toThrow();
  });

  it.each(['dispatch_started', 'provider_accepted', 'finalised', 'uncertain', 'failed'] as const)(
    'rejects a shadow effect in the %s state',
    (state) => {
      const effects = [effect('email_dispatch', state, null)];
      expect(backgroundJobEffectCheckpointsComplete('quote_send', effects, 1, 'shadow')).toBe(false);
      expect(getBackgroundJobEffectCompletionIssues('quote_send', effects, 1, 'shadow')).toContainEqual({
        reason: 'shadow_effect_not_prepared',
        effectKind: 'email_dispatch',
        state,
      });
    },
  );

  it('still rejects duplicate and undeclared prepared effects for shadow completion', () => {
    const effects = [
      effect('email_dispatch', 'prepared', null),
      effect('email_dispatch', 'prepared', null),
      effect('storage_upload', 'prepared', null),
    ];
    expect(getBackgroundJobEffectCompletionIssues('quote_send', effects, 1, 'shadow')).toEqual(
      expect.arrayContaining([
        { reason: 'duplicate_effect_kind', effectKind: 'email_dispatch' },
        { reason: 'undeclared_effect', effectKind: 'storage_upload' },
      ]),
    );
    expect(backgroundJobEffectCheckpointsComplete('quote_send', effects, 1, 'shadow')).toBe(false);
  });

  it('validates the contract version on completion-policy lookup', () => {
    expect(() => backgroundJobEffectCheckpointsComplete('quote_send', [], 2)).toThrow(
      /unsupported.*contract version/i,
    );
  });
});

describe('background job retry idempotency windows', () => {
  it('does not require an idempotency expiry for shadow prepared effects', () => {
    expect(retryDecision('prepared', null, 'shadow')).toEqual({
      retry: true,
      delayMs: 30_000,
      reason: null,
    });
    expect(retryDecision('prepared', NOW_MS - 1, 'shadow')).toEqual({
      retry: true,
      delayMs: 30_000,
      reason: null,
    });
  });

  it.each(['prepared', 'failed', 'uncertain'] as const)(
    'blocks %s work with missing, invalid, expired, or delay-crossed idempotency expiry',
    (state) => {
      expect(retryDecision(state, null)).toMatchObject({
        retry: false,
        reason: 'provider_idempotency_window_expired',
      });
      expect(
        getBackgroundJobAutomaticRetryDecision({
          kind: 'quote_send',
          contractVersion: 1,
          attemptNumber: 1,
          elapsedSinceFirstAttemptMs: 0,
          effects: [
            {
              effectKind: 'email_dispatch',
              state,
              providerIdempotencyExpiresAt: 'not-a-timestamp',
            },
          ],
          nowMs: NOW_MS,
        }),
      ).toMatchObject({ retry: false, reason: 'provider_idempotency_window_expired' });
      expect(retryDecision(state, NOW_MS)).toMatchObject({
        retry: false,
        reason: 'provider_idempotency_window_expired',
      });
      expect(retryDecision(state, NOW_MS + 30_000)).toMatchObject({
        retry: false,
        reason: 'provider_idempotency_window_expired',
      });
    },
  );

  it.each(['prepared', 'failed', 'uncertain'] as const)(
    'allows %s work only when the whole retry delay remains inside the frozen window',
    (state) => {
      expect(retryDecision(state, NOW_MS + 30_001)).toEqual({
        retry: true,
        delayMs: 30_000,
        reason: null,
      });
    },
  );

  it('uses the earliest expiry across every redispatchable effect', () => {
    const decision = getBackgroundJobAutomaticRetryDecision({
      kind: 'quote_send',
      contractVersion: 1,
      attemptNumber: 1,
      elapsedSinceFirstAttemptMs: 0,
      effects: [
        effect('email_dispatch', 'failed', NOW_MS + 60_000),
        effect('another_effect', 'prepared', NOW_MS + 20_000),
      ],
      nowMs: NOW_MS,
    });
    expect(decision).toEqual({
      retry: false,
      delayMs: null,
      reason: 'provider_idempotency_window_expired',
    });
  });

  it('keeps provider-accepted and unknown-dispatch outcomes blocked before expiry planning', () => {
    expect(retryDecision('provider_accepted', null)).toMatchObject({
      retry: false,
      reason: 'provider_already_accepted',
    });
    expect(retryDecision('finalised', null)).toMatchObject({
      retry: false,
      reason: 'provider_already_accepted',
    });
    expect(retryDecision('dispatch_started', null)).toMatchObject({
      retry: false,
      reason: 'provider_outcome_unknown',
    });
  });

  it('validates the contract version before planning a retry', () => {
    expect(() =>
      getBackgroundJobAutomaticRetryDecision({
        kind: 'quote_send',
        contractVersion: 2,
        attemptNumber: 1,
        elapsedSinceFirstAttemptMs: 0,
        effects: [],
        nowMs: NOW_MS,
      }),
    ).toThrow(/unsupported.*contract version/i);
  });
});
