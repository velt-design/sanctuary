import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_JOB_DATABASE_MAX_RETRY_DELAY_MS,
  BACKGROUND_JOB_EFFECT_STATES,
  BACKGROUND_JOB_EVENT_TYPES,
  BACKGROUND_JOB_EXECUTION_OWNERS,
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_MAX_AUTOMATIC_RETRY_WINDOW_MS,
  BACKGROUND_JOB_REGISTRY,
  BACKGROUND_JOB_ROLLOUT_MODES,
  BACKGROUND_JOB_SAFE_SUMMARY_MAX_ARRAY_LENGTH,
  BACKGROUND_JOB_SAFE_SUMMARY_MAX_BYTES,
  BACKGROUND_JOB_SAFE_SUMMARY_MAX_STRING_LENGTH,
  BACKGROUND_JOB_STATUSES,
  TERMINAL_BACKGROUND_JOB_STATUSES,
  assertBackgroundJobEffectTransition,
  assertBackgroundJobSafeEffectSummary,
  assertBackgroundJobSafeEventSummary,
  assertBackgroundJobSafeProgressSummary,
  assertBackgroundJobSafeResultSummary,
  assertBackgroundJobSafeWorkerSummary,
  assertBackgroundJobTransition,
  backgroundJobEffectCheckpointsComplete,
  backgroundJobEffectTransitionAllowed,
  backgroundJobTransitionAllowed,
  getBackgroundJobAutomaticRetryDecision,
  getBackgroundJobDefinition,
  getBackgroundJobUserFacingStatus,
  getMissingBackgroundJobEffectCheckpoints,
  isBackgroundJobObviouslySensitiveString,
  isBackgroundJobQueueMessage,
  isBackgroundJobSafeEffectSummary,
  isBackgroundJobSafeEventSummary,
  isBackgroundJobSafeProgressSummary,
  isBackgroundJobSafeResultSummary,
  isBackgroundJobSafeWorkerSummary,
  toBackgroundJobUserFacingRecord,
  type BackgroundJobSafeRecord,
} from '@sp/jobs';

const foundation = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260720_000001_background_job_foundation.sql'),
  'utf8',
);
const providerReconciliation = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260720_000007_background_job_provider_reconciliation.sql'),
  'utf8',
);
const effectiveTransitionSql = `${foundation}\n${providerReconciliation}`;

function enumValues(enumName: string): string[] {
  const block = foundation.match(
    new RegExp(`create type public\\.${enumName} as enum \\(([\\s\\S]*?)\\);`, 'i'),
  )?.[1];
  if (!block) throw new Error(`Missing SQL enum: ${enumName}`);
  return Array.from(block.matchAll(/'([^']+)'/g), (match) => match[1]);
}

function sqlTransitionTargets(functionName: string, from: string): string[] {
  const definitions = Array.from(
    effectiveTransitionSql.matchAll(
      new RegExp(`create or replace function public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`, 'gi'),
    ),
    (match) => match[0],
  );
  const functionSource = definitions.at(-1);
  if (!functionSource) throw new Error(`Missing SQL transition function: ${functionName}`);

  const list = functionSource.match(new RegExp(`when '${from}' then p_to in \\(([^)]*)\\)`, 'i'))?.[1];
  if (list) return Array.from(list.matchAll(/'([^']+)'/g), (match) => match[1]);

  const single = functionSource.match(new RegExp(`when '${from}' then p_to = '([^']+)'`, 'i'))?.[1];
  return single ? [single] : [];
}

function finalisedEffects(kind: (typeof BACKGROUND_JOB_KINDS)[number]) {
  return getBackgroundJobDefinition(kind).requiredEffectCheckpoints.map((effectKind) => ({
    effectKind,
    state: 'finalised' as const,
    providerIdempotencyExpiresAt: null,
  }));
}

describe('background job contracts', () => {
  it('keeps every exported database enum aligned with the foundation migration', () => {
    expect(enumValues('background_job_status')).toEqual(BACKGROUND_JOB_STATUSES);
    expect(enumValues('background_job_effect_state')).toEqual(BACKGROUND_JOB_EFFECT_STATES);
    expect(enumValues('background_job_rollout_mode')).toEqual(BACKGROUND_JOB_ROLLOUT_MODES);
    expect(enumValues('background_job_execution_owner')).toEqual(BACKGROUND_JOB_EXECUTION_OWNERS);
    expect(enumValues('background_job_event_type')).toEqual(BACKGROUND_JOB_EVENT_TYPES);
  });

  it('keeps the complete kind registry aligned with the database seed policy', () => {
    const seedBlock = foundation.match(
      /insert into public\.background_job_kinds\s*\([\s\S]*?\)\s*values([\s\S]*?);/i,
    )?.[1];
    if (!seedBlock) throw new Error('Missing background_job_kinds seed');

    const seededKinds = Array.from(
      seedBlock.matchAll(
        /\('([^']+)',\s*(\d+),\s*'([^']+)',\s*(\d+),\s*(\d+),\s*'([^']+)',\s*(true|false),\s*(array\[[^\]]*\](?:::text\[\])?),\s*(true|false)\)/g,
      ),
      (match) => ({
        kind: match[1],
        contractVersion: Number(match[2]),
        handlerOwner: match[3],
        maxAttempts: Number(match[4]),
        timeoutSeconds: Number(match[5]),
        concurrencyClass: match[6],
        hasExternalSideEffect: match[7] === 'true',
        requiredEffectCheckpoints: Array.from(match[8].matchAll(/'([^']+)'/g), (effect) => effect[1]),
        cancellationAllowed: match[9] === 'true',
      }),
    );
    const packageKinds = BACKGROUND_JOB_KINDS.filter((kind) => kind !== 'ai_synthetic_v1').map((kind) => {
      const definition = getBackgroundJobDefinition(kind);
      return {
        kind,
        contractVersion: definition.payloadContractVersion,
        handlerOwner: definition.handlerOwner,
        maxAttempts: definition.retry.maxAttempts,
        timeoutSeconds: definition.timeoutMs / 1_000,
        concurrencyClass: definition.concurrencyClass,
        hasExternalSideEffect: definition.hasExternalSideEffect,
        requiredEffectCheckpoints: [...definition.requiredEffectCheckpoints],
        cancellationAllowed: definition.cancellationAllowed,
      };
    });

    expect(seededKinds).toEqual(packageKinds);
    expect(foundation).toMatch(
      /default_rollout_mode public\.background_job_rollout_mode not null default 'legacy'/i,
    );
    expect(Object.keys(BACKGROUND_JOB_REGISTRY)).toEqual(BACKGROUND_JOB_KINDS);
  });

  it('keeps every job transition exactly aligned with SQL', () => {
    for (const from of BACKGROUND_JOB_STATUSES) {
      const packageTargets = BACKGROUND_JOB_STATUSES.filter(
        (to) => to !== from && backgroundJobTransitionAllowed(from, to),
      ).sort();
      expect(packageTargets, from).toEqual(sqlTransitionTargets('background_job_transition_allowed', from).sort());
      expect(backgroundJobTransitionAllowed(from, from), from).toBe(true);
    }
  });

  it('keeps every effect transition exactly aligned with SQL and permits same-identity safe redispatch', () => {
    for (const from of BACKGROUND_JOB_EFFECT_STATES) {
      const packageTargets = BACKGROUND_JOB_EFFECT_STATES.filter(
        (to) => to !== from && backgroundJobEffectTransitionAllowed(from, to),
      ).sort();
      expect(packageTargets, from).toEqual(
        sqlTransitionTargets('background_job_effect_transition_allowed', from).sort(),
      );
      expect(backgroundJobEffectTransitionAllowed(from, from), from).toBe(true);
    }

    expect(backgroundJobEffectTransitionAllowed('failed', 'dispatch_started')).toBe(true);
    expect(backgroundJobEffectTransitionAllowed('failed', 'provider_accepted')).toBe(true);
    expect(backgroundJobEffectTransitionAllowed('uncertain', 'dispatch_started')).toBe(true);
    expect(backgroundJobEffectTransitionAllowed('provider_accepted', 'dispatch_started')).toBe(false);
  });

  it('rejects invalid job and effect transitions', () => {
    expect(backgroundJobTransitionAllowed('queued', 'claimed')).toBe(true);
    expect(backgroundJobTransitionAllowed('dispatching', 'provider_accepted')).toBe(true);
    expect(backgroundJobTransitionAllowed('retrying', 'provider_accepted')).toBe(true);
    expect(backgroundJobTransitionAllowed('needs_attention', 'provider_accepted')).toBe(true);
    expect(backgroundJobTransitionAllowed('permanent_failed', 'provider_accepted')).toBe(true);
    expect(backgroundJobTransitionAllowed('succeeded', 'needs_attention')).toBe(true);
    expect(backgroundJobTransitionAllowed('cancelled', 'needs_attention')).toBe(true);
    expect(backgroundJobTransitionAllowed('provider_accepted', 'queued')).toBe(false);
    expect(() => assertBackgroundJobTransition('succeeded', 'queued')).toThrow(/invalid background-job transition/i);
    expect(() => assertBackgroundJobEffectTransition('provider_accepted', 'dispatch_started')).toThrow(
      /invalid background-job effect transition/i,
    );
  });

  it('makes retry, idempotency, checkpoint, and presentation policy explicit for every kind', () => {
    const expectedIdempotency = {
      deposit_invoice_prepare_and_send: 'provider_and_effect_checkpoint',
      quote_send: 'provider_and_effect_checkpoint',
      quote_resend: 'provider_and_effect_checkpoint',
      job_pack_generate: 'input_hash_artifact_reuse',
      automation_event: 'event_intent',
      email_outbox_deliver: 'outbox_intent',
      ai_synthetic_v1: 'ai_task_input_snapshot',
    } as const;

    for (const kind of BACKGROUND_JOB_KINDS) {
      const definition = getBackgroundJobDefinition(kind);
      expect(definition.kind).toBe(kind);
      expect(definition.payloadContractVersion).toBeGreaterThan(0);
      expect(definition.defaultRolloutMode).toBe(kind === 'ai_synthetic_v1' ? 'worker_enabled' : 'legacy');
      expect(definition.retry.maxAttempts).toBeGreaterThan(0);
      expect(definition.retry.baseDelayMs).toBeGreaterThanOrEqual(1_000);
      expect(definition.retry.maximumDelayMs).toBeGreaterThanOrEqual(definition.retry.baseDelayMs);
      expect(definition.retry.maximumDelayMs).toBeLessThanOrEqual(BACKGROUND_JOB_DATABASE_MAX_RETRY_DELAY_MS);
      expect(definition.retry.automaticRetryWindowMs).toBeLessThanOrEqual(
        BACKGROUND_JOB_MAX_AUTOMATIC_RETRY_WINDOW_MS,
      );
      expect(definition.requiredHandlerCheckpoints.length).toBeGreaterThan(0);
      expect(new Set(definition.requiredHandlerCheckpoints).size).toBe(definition.requiredHandlerCheckpoints.length);
      expect(new Set(definition.requiredEffectCheckpoints).size).toBe(definition.requiredEffectCheckpoints.length);
      expect(
        definition.requiredHandlerCheckpoints.some((checkpoint) =>
          definition.requiredEffectCheckpoints.includes(checkpoint),
        ),
      ).toBe(false);
      expect(definition.idempotencyStrategy).toBe(expectedIdempotency[kind]);
      expect(Object.keys(definition.userFacingStatus).sort()).toEqual([...BACKGROUND_JOB_STATUSES].sort());
      for (const status of BACKGROUND_JOB_STATUSES) {
        const label = getBackgroundJobUserFacingStatus(kind, status);
        expect(label, `${kind}:${status}`).toMatch(/^[A-Z][^_]{1,79}$/);
      }
      if (definition.hasExternalSideEffect) {
        expect(definition.cancellationAllowed).toBe(false);
        expect(definition.requiredEffectCheckpoints.length).toBeGreaterThan(0);
      } else {
        expect(definition.requiredEffectCheckpoints).toEqual([]);
      }
    }
  });

  it('accepts only the exact minimal queue-message contract', () => {
    const message = {
      jobId: '8b50378a-70c5-4c63-a47d-f31f27ed30ee',
      contractVersion: 1,
    };
    expect(isBackgroundJobQueueMessage(message)).toBe(true);
    expect(isBackgroundJobQueueMessage({ ...message, recipient: 'customer@example.test' })).toBe(false);
    expect(isBackgroundJobQueueMessage({ ...message, payload: {} })).toBe(false);
    expect(isBackgroundJobQueueMessage({ contractVersion: 1 })).toBe(false);
    expect(isBackgroundJobQueueMessage({ ...message, contractVersion: 0 })).toBe(false);
    expect(isBackgroundJobQueueMessage({ ...message, contractVersion: 2_147_483_648 })).toBe(false);
    expect(isBackgroundJobQueueMessage({ ...message, jobId: 'not-a-uuid' })).toBe(false);
  });

  it('accepts only the documented fields and value shapes for each safe-summary context', () => {
    const timestamp = '2026-07-20T01:02:03.456Z';
    const jobId = '8b50378a-70c5-4c63-a47d-f31f27ed30ee';
    const artifactId = 'artifact-123';

    for (const validator of [
      isBackgroundJobSafeProgressSummary,
      isBackgroundJobSafeResultSummary,
      isBackgroundJobSafeEffectSummary,
      isBackgroundJobSafeEventSummary,
      isBackgroundJobSafeWorkerSummary,
    ]) {
      expect(validator({})).toBe(true);
    }

    expect(
      isBackgroundJobSafeProgressSummary({
        phase: 'pdf_generation',
        progressCode: 'RENDERING',
        completedPhases: ['inputs_frozen', 'pdf_staged'],
        pendingPhases: ['business_finalised'],
        processedCount: 2,
        totalCount: 4,
        percentComplete: 50.5,
        retryable: true,
        updatedAt: timestamp,
      }),
    ).toBe(true);
    expect(
      isBackgroundJobSafeResultSummary({
        phase: 'succeeded',
        resultCode: 'ARTIFACT_READY',
        artifactId,
        artifactIds: [artifactId, 'artifact-456'],
        quoteId: jobId,
        artifactCount: 2,
        cached: false,
        providerAccepted: true,
        completedAt: timestamp,
      }),
    ).toBe(true);
    expect(
      isBackgroundJobSafeEffectSummary({
        effectKind: 'email_dispatch',
        checkpoint: 'provider_accepted',
        previousCheckpoint: null,
        providerName: 'resend',
        effectId: 'effect-123',
        providerMessageId: jobId,
        attemptNumber: 1,
        providerStatusCode: 202,
        providerAccepted: true,
        providerAcceptedAt: timestamp,
      }),
    ).toBe(true);
    expect(
      isBackgroundJobSafeEventSummary({
        reason: 'missing_canonical_message',
        kind: 'quote_send',
        owner: 'worker',
        jobId,
        queueMessageId: 42,
        delaySeconds: 30,
        effectKind: 'email_dispatch',
        checkpoint: 'finalised',
        occurredAt: timestamp,
      }),
    ).toBe(true);
    expect(
      isBackgroundJobSafeWorkerSummary({
        mode: 'active',
        lifecycleState: 'ready',
        buildVersion: 'v1.2.3',
        supportedKinds: ['quote_send', 'job_pack_generate'],
        concurrencyClasses: ['email', 'documents'],
        globalConcurrency: 8,
        activeJobCount: 2,
        queueDepth: 4,
        acceptingJobs: true,
        drainRequested: false,
        lastHeartbeatAt: '2026-07-20T11:02:03+10:00',
      }),
    ).toBe(true);
  });

  it('bounds safe percentages to six fractional decimal places', () => {
    expect(isBackgroundJobSafeProgressSummary({ percentComplete: 33.333333 })).toBe(true);
    expect(isBackgroundJobSafeEventSummary({ percentComplete: 0.000001 })).toBe(true);
    expect(isBackgroundJobSafeProgressSummary({ percentComplete: 33.3333333 })).toBe(false);
    expect(isBackgroundJobSafeEventSummary({ percentComplete: 0.0000001 })).toBe(false);
  });

  it('rejects unknown keys, free-form customer data, recipient arrays, and provider payload objects', () => {
    expect(isBackgroundJobSafeProgressSummary({ customerName: 'Ada Lovelace' })).toBe(false);
    expect(
      isBackgroundJobSafeResultSummary({
        message: 'Artifact ready for the customer',
      }),
    ).toBe(false);
    expect(
      isBackgroundJobSafeEventSummary({
        recipients: ['customer@example.test'],
      }),
    ).toBe(false);
    expect(isBackgroundJobSafeEventSummary({ recipientIds: ['contact-123'] })).toBe(false);
    expect(
      isBackgroundJobSafeEffectSummary({
        providerPayload: { id: 'provider-123' },
      }),
    ).toBe(false);
    expect(
      isBackgroundJobSafeEffectSummary({
        providerName: { id: 'provider-123' },
      }),
    ).toBe(false);
    expect(isBackgroundJobSafeWorkerSummary({ region: 'Sydney' })).toBe(false);
    expect(
      isBackgroundJobSafeProgressSummary({
        phase: 'Preparing invoice for Ada Lovelace',
      }),
    ).toBe(false);
  });

  it('rejects sensitive strings even when they are stored under an allowed key', () => {
    const syntheticJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.c3ludGhldGljLXNpZ25hdHVyZQ';

    expect(isBackgroundJobSafeProgressSummary({ phase: 'customer@example.test' })).toBe(false);
    expect(
      isBackgroundJobSafeProgressSummary({
        progressCode: 'Bearer synthetic-credential-123',
      }),
    ).toBe(false);
    expect(
      isBackgroundJobSafeResultSummary({
        artifactId: 'Basic dXNlcjpwYXNzd29yZA==',
      }),
    ).toBe(false);
    expect(
      isBackgroundJobSafeResultSummary({
        artifactId: 'https://example.test/public/quote-123',
      }),
    ).toBe(false);
    expect(
      isBackgroundJobSafeResultSummary({
        artifactId: 'files.example.test/public/quote-123',
      }),
    ).toBe(false);
    expect(isBackgroundJobSafeResultSummary({ artifactId: 'files1.example.test' })).toBe(false);
    expect(
      isBackgroundJobSafeResultSummary({
        artifactId: 'https://example.test/file?token=synthetic-token',
      }),
    ).toBe(false);
    expect(
      isBackgroundJobSafeResultSummary({
        artifactId: 'https://storage.example.test/file?X-Amz-Signature=synthetic-signature',
      }),
    ).toBe(false);
    expect(isBackgroundJobSafeEffectSummary({ providerMessageId: syntheticJwt })).toBe(false);
    expect(isBackgroundJobSafeEventSummary({ reason: 'a'.repeat(64) })).toBe(false);
    expect(isBackgroundJobSafeWorkerSummary({ buildVersion: 'a1'.repeat(24) })).toBe(false);

    expect(isBackgroundJobObviouslySensitiveString('sk_syntheticCredentialValue123456789')).toBe(true);
    expect(isBackgroundJobObviouslySensitiveString('person@example.test')).toBe(true);
    expect(isBackgroundJobObviouslySensitiveString('provider_reconciliation')).toBe(false);
  });

  it('rejects unsafe scalar, timestamp, array, object, and byte-boundary shapes', () => {
    expect(isBackgroundJobSafeProgressSummary({ processedCount: Number.NaN })).toBe(false);
    expect(isBackgroundJobSafeProgressSummary({ processedCount: 1.5 })).toBe(false);
    expect(isBackgroundJobSafeProgressSummary({ processedCount: -1 })).toBe(false);
    expect(isBackgroundJobSafeProgressSummary({ percentComplete: 100.1 })).toBe(false);
    expect(
      isBackgroundJobSafeProgressSummary({
        completedAt: '2026-02-30T00:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      isBackgroundJobSafeResultSummary({
        artifactId: 'artifact-without-a-number',
      }),
    ).toBe(false);
    expect(
      isBackgroundJobSafeResultSummary({
        artifactIds: ['artifact-123', 'customer@example.test'],
      }),
    ).toBe(false);
    expect(
      isBackgroundJobSafeWorkerSummary({
        supportedKinds: Array.from(
          { length: BACKGROUND_JOB_SAFE_SUMMARY_MAX_ARRAY_LENGTH + 1 },
          (_, index) => `kind_${index}`,
        ),
      }),
    ).toBe(false);

    const sparsePhases = ['prepare', 'render'];
    delete sparsePhases[0];
    expect(isBackgroundJobSafeProgressSummary({ completedPhases: sparsePhases })).toBe(false);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isBackgroundJobSafeEffectSummary({ providerName: cyclic })).toBe(false);

    const ids = Array.from(
      { length: BACKGROUND_JOB_SAFE_SUMMARY_MAX_ARRAY_LENGTH },
      (_, index) => `artifact-${index}-${'x'.repeat(32)}`,
    );
    const phases = Array.from(
      { length: BACKGROUND_JOB_SAFE_SUMMARY_MAX_ARRAY_LENGTH },
      (_, index) => `phase_${index}_${'x'.repeat(32)}`,
    );
    expect(
      isBackgroundJobSafeEventSummary({
        artifactIds: ids,
        documentIds: ids,
        completedPhases: phases,
        pendingPhases: phases,
      }),
    ).toBe(false);
    expect(BACKGROUND_JOB_SAFE_SUMMARY_MAX_BYTES).toBe(8_192);
    expect(BACKGROUND_JOB_SAFE_SUMMARY_MAX_STRING_LENGTH).toBe(128);
    expect(BACKGROUND_JOB_SAFE_SUMMARY_MAX_ARRAY_LENGTH).toBe(50);
  });

  it('uses context-specific assertions rather than a generic safe-JSON assertion', () => {
    expect(() =>
      assertBackgroundJobSafeProgressSummary({
        recipientEmail: 'customer@example.test',
      }),
    ).toThrow('Unsafe background-job progress summary');
    expect(() => assertBackgroundJobSafeResultSummary({ providerPayload: {} })).toThrow(
      'Unsafe background-job result summary',
    );
    expect(() => assertBackgroundJobSafeEffectSummary({ providerPayload: {} })).toThrow(
      'Unsafe background-job effect summary',
    );
    expect(() => assertBackgroundJobSafeEventSummary({ customerName: 'Ada Lovelace' })).toThrow(
      'Unsafe background-job event summary',
    );
    expect(() => assertBackgroundJobSafeWorkerSummary({ accessToken: 'synthetic' })).toThrow(
      'Unsafe background-job worker summary',
    );
  });

  it('maps staff-facing records without internal phases, hashes, leases, provider IDs, or raw errors', () => {
    const internalRecord = {
      id: '8b50378a-70c5-4c63-a47d-f31f27ed30ee',
      kind: 'quote_send',
      contractVersion: 1,
      subjectType: 'quote',
      subjectId: 'quote-1',
      projectId: '2d6f06f1-81d7-45fb-9758-13dc0c096cec',
      status: 'needs_attention',
      priority: 100,
      attemptCount: 3,
      maxAttempts: 6,
      nextAttemptAt: '2026-07-20T01:00:00.000Z',
      cancellationRequestedAt: null,
      rolloutMode: 'worker_enabled',
      executionOwner: 'worker',
      safeProgress: { phase: 'provider_reconciliation', completedCount: 2 },
      safeResult: {},
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:30:00.000Z',
      startedAt: '2026-07-20T00:01:00.000Z',
      completedAt: '2026-07-20T00:30:00.000Z',
      currentPhase: 'provider_reconciliation',
      errorCode: 'PROVIDER_INTERNAL_CODE',
    } satisfies BackgroundJobSafeRecord;

    const userFacing = toBackgroundJobUserFacingRecord(internalRecord);
    expect(userFacing).toEqual({
      id: internalRecord.id,
      kind: 'quote_send',
      status: 'needs_attention',
      statusLabel: 'Needs attention',
      attemptCount: 3,
      maxAttempts: 6,
      nextAttemptAt: internalRecord.nextAttemptAt,
      cancellationRequested: false,
      progress: { phase: 'provider_reconciliation', completedCount: 2 },
      result: {},
      createdAt: internalRecord.createdAt,
      updatedAt: internalRecord.updatedAt,
      startedAt: internalRecord.startedAt,
      completedAt: internalRecord.completedAt,
    });
    expect(userFacing).not.toHaveProperty('currentPhase');
    expect(userFacing).not.toHaveProperty('rolloutMode');
    expect(userFacing).not.toHaveProperty('executionOwner');
    expect(userFacing).not.toHaveProperty('errorCode');

    expect(() =>
      toBackgroundJobUserFacingRecord({
        ...internalRecord,
        safeProgress: { phase: 'customer@example.test' },
      } as unknown as BackgroundJobSafeRecord),
    ).toThrow('Unsafe background-job progress summary');
  });

  it('plans bounded automatic retries and blocks unsafe provider outcomes', () => {
    const nowMs = Date.parse('2026-07-20T00:00:00.000Z');
    const base = {
      kind: 'quote_send' as const,
      attemptNumber: 1,
      elapsedSinceFirstAttemptMs: 0,
      effects: [],
      nowMs,
    };

    expect(getBackgroundJobAutomaticRetryDecision(base)).toEqual({ retry: true, delayMs: 30_000, reason: null });
    expect(getBackgroundJobAutomaticRetryDecision({ ...base, attemptNumber: 6 })).toEqual({
      retry: false,
      delayMs: null,
      reason: 'attempts_exhausted',
    });
    expect(
      getBackgroundJobAutomaticRetryDecision({ ...base, elapsedSinceFirstAttemptMs: 20 * 60 * 60 * 1_000 }),
    ).toEqual({ retry: false, delayMs: null, reason: 'automatic_retry_window_expired' });
    expect(
      getBackgroundJobAutomaticRetryDecision({
        ...base,
        elapsedSinceFirstAttemptMs: 20 * 60 * 60 * 1_000 - 10_000,
      }),
    ).toEqual({ retry: true, delayMs: 9_000, reason: null });
    expect(
      getBackgroundJobAutomaticRetryDecision({
        ...base,
        effects: [{ effectKind: 'email_dispatch', state: 'dispatch_started', providerIdempotencyExpiresAt: null }],
      }),
    ).toEqual({ retry: false, delayMs: null, reason: 'provider_idempotency_window_expired' });
    expect(
      getBackgroundJobAutomaticRetryDecision({
        ...base,
        effects: [
          {
            effectKind: 'email_dispatch',
            state: 'dispatch_started',
            providerIdempotencyExpiresAt: new Date(nowMs + 30_001).toISOString(),
          },
        ],
      }),
    ).toEqual({ retry: true, delayMs: 30_000, reason: null });
    expect(
      getBackgroundJobAutomaticRetryDecision({
        ...base,
        effects: [{ effectKind: 'email_dispatch', state: 'provider_accepted', providerIdempotencyExpiresAt: null }],
      }),
    ).toEqual({ retry: false, delayMs: null, reason: 'provider_already_accepted' });
    expect(
      getBackgroundJobAutomaticRetryDecision({
        ...base,
        effects: [
          {
            effectKind: 'email_dispatch',
            state: 'uncertain',
            providerIdempotencyExpiresAt: '2026-07-19T23:59:59.000Z',
          },
        ],
      }),
    ).toEqual({ retry: false, delayMs: null, reason: 'provider_idempotency_window_expired' });
    expect(
      getBackgroundJobAutomaticRetryDecision({
        ...base,
        effects: [
          {
            effectKind: 'email_dispatch',
            state: 'uncertain',
            providerIdempotencyExpiresAt: '2026-07-20T01:00:00.000Z',
          },
        ],
      }).retry,
    ).toBe(true);
    expect(
      getBackgroundJobAutomaticRetryDecision({
        ...base,
        effects: [
          {
            effectKind: 'email_dispatch',
            state: 'uncertain',
            providerIdempotencyExpiresAt: '2026-07-20T00:00:10.000Z',
          },
        ],
      }),
    ).toEqual({ retry: false, delayMs: null, reason: 'provider_idempotency_window_expired' });
    expect(
      getBackgroundJobAutomaticRetryDecision({
        ...base,
        effects: [{ effectKind: 'email_dispatch', state: 'failed', providerIdempotencyExpiresAt: null }],
      }),
    ).toEqual({ retry: false, delayMs: null, reason: 'provider_idempotency_window_expired' });
  });

  it('requires a finalised effect of every registered checkpoint kind', () => {
    const effects = finalisedEffects('quote_send');
    expect(backgroundJobEffectCheckpointsComplete('quote_send', effects)).toBe(true);
    expect(getMissingBackgroundJobEffectCheckpoints('quote_send', [])).toEqual(['email_dispatch']);
    expect(
      backgroundJobEffectCheckpointsComplete('quote_send', [
        { effectKind: 'email_dispatch', state: 'failed', providerIdempotencyExpiresAt: null },
      ]),
    ).toBe(false);
    expect(backgroundJobEffectCheckpointsComplete('job_pack_generate', [])).toBe(true);
  });

  it('keeps every status and effect state represented by policy', () => {
    for (const status of BACKGROUND_JOB_STATUSES) {
      expect(backgroundJobTransitionAllowed(status, status)).toBe(true);
    }
    expect(TERMINAL_BACKGROUND_JOB_STATUSES).toEqual([
      'succeeded',
      'cancelled',
      'needs_attention',
      'permanent_failed',
    ]);
    expect(BACKGROUND_JOB_EFFECT_STATES).toEqual([
      'prepared',
      'dispatch_started',
      'provider_accepted',
      'finalised',
      'uncertain',
      'failed',
    ]);
  });
});
