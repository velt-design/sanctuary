import {
  RESEND_PROVIDER_NAME,
  createDurableResendEmailDispatch,
  createResendIdempotencyExpiresAt,
  type DurableResendEmailDispatch,
  type EmailMessageInput,
  type ResendDispatchOutcome,
  type ResendEmailGateway,
} from '@sp/email-provider';
import {
  backgroundJobEffectTransitionAllowed,
  type BackgroundJobEffectState,
  type BackgroundJobWorkerEffect,
} from '@sp/jobs';
import { describe, expect, it } from 'vitest';

import type { BackgroundJobHandlerRpc, RuntimeClock } from '../runtime/contracts';
import {
  PROVIDER_ACCEPTED_EMAIL_METADATA,
  dispatchDurableEmailEffect,
  finaliseDurableEmailEffect,
} from './durableEmailEffect';

const NOW = Date.parse('2026-07-20T01:02:03.000Z');
const JOB_ID = '33333333-3333-4333-8333-333333333333';
const INTENT_ID = 'quote-send:intent-42';
const CONTRACT_VERSION = 1;
const EFFECT_KEY = 'commercial-email:quote-send-42';
const QUEUE_MESSAGE_ID = 7301;
const PROVIDER_MESSAGE_ID = 'resend-commercial-delivery-42';
const IDEMPOTENCY_EXPIRES_AT = createResendIdempotencyExpiresAt(NOW);

const MESSAGE = Object.freeze({
  from: 'Sanctuary <quotes@sanctuary.example>',
  to: ['customer@example.com'],
  subject: 'Your approved Sanctuary quote',
  html: '<p>Your approved quote is ready. Token: quote-token-42</p>',
  text: 'Your approved quote is ready. Token: quote-token-42',
  attachments: [{
    filename: 'quote-42.pdf',
    content: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]),
    contentType: 'application/pdf',
  }],
}) satisfies EmailMessageInput;

const CANONICAL_DISPATCH = createDurableResendEmailDispatch({
  jobId: JOB_ID,
  effectKey: EFFECT_KEY,
  idempotencyExpiresAt: IDEMPOTENCY_EXPIRES_AT,
  message: MESSAGE,
});

const CANONICAL_QUEUE_BODY = JSON.stringify({ jobId: JOB_ID, contractVersion: CONTRACT_VERSION });

const CRASH_POINTS = [
  { id: 1, label: 'after enqueue before API response' },
  { id: 2, label: 'after queue read before claim' },
  { id: 3, label: 'after claim before preparation' },
  { id: 4, label: 'after artifact staging' },
  { id: 5, label: 'immediately before provider call' },
  { id: 6, label: 'after provider acceptance before response' },
  { id: 7, label: 'after response before checkpoint' },
  { id: 8, label: 'after checkpoint before business finalisation' },
  { id: 8.5, label: 'after business finaliser commit before finalised checkpoint' },
  { id: 9, label: 'after finalisation before queue archival' },
  { id: 10, label: 'after queue archival before local worker return' },
] as const;

type CrashPoint = (typeof CRASH_POINTS)[number]['id'];
type CheckpointInput = Parameters<BackgroundJobHandlerRpc['recordEffectCheckpoint']>[0];

type Boundary = Readonly<{
  promise: Promise<void>;
  reach(): void;
}>;

function boundary(): Boundary {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, reach: resolve };
}

function hardProcessDeath<Result>(crashBoundary: Boundary): Promise<Result> {
  crashBoundary.reach();
  return new Promise<Result>(() => undefined);
}

const persistentClock: RuntimeClock = Object.freeze({
  now: () => NOW,
  sleep: async () => undefined,
});

type JobRecord = {
  id: string;
  intentId: string;
  status: 'queued' | 'active' | 'succeeded';
};

type QueueMessage = {
  id: number;
  jobId: string;
  canonicalBody: string;
  archived: boolean;
};

type ProviderCall = Readonly<{
  idempotencyKey: string;
  payloadHash: string;
  canonicalRequestBody: string;
}>;

type ProviderDelivery = ProviderCall & Readonly<{
  messageId: string;
}>;

class PersistentProvider {
  readonly calls: ProviderCall[] = [];
  readonly deliveries = new Map<string, ProviderDelivery>();

  dispatch(dispatch: DurableResendEmailDispatch): ResendDispatchOutcome {
    const call = {
      idempotencyKey: dispatch.idempotencyKey,
      payloadHash: dispatch.payloadHash,
      canonicalRequestBody: dispatch.canonicalRequestBody,
    };
    this.calls.push(call);

    const existing = this.deliveries.get(dispatch.idempotencyKey);
    if (existing) {
      if (
        existing.payloadHash !== dispatch.payloadHash ||
        existing.canonicalRequestBody !== dispatch.canonicalRequestBody
      ) {
        return {
          outcome: 'idempotency_conflict',
          code: 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT',
          provider: RESEND_PROVIDER_NAME,
          statusCode: 409,
          durationMs: 1,
        };
      }
      return {
        outcome: 'accepted',
        code: 'RESEND_ACCEPTED',
        provider: RESEND_PROVIDER_NAME,
        messageId: existing.messageId,
        statusCode: 200,
        durationMs: 1,
      };
    }

    this.deliveries.set(dispatch.idempotencyKey, {
      ...call,
      messageId: PROVIDER_MESSAGE_ID,
    });
    return {
      outcome: 'accepted',
      code: 'RESEND_ACCEPTED',
      provider: RESEND_PROVIDER_NAME,
      messageId: PROVIDER_MESSAGE_ID,
      statusCode: 200,
      durationMs: 1,
    };
  }
}

type EffectEvent = Readonly<{
  sequence: number;
  state: BackgroundJobEffectState;
  source: 'worker' | 'recovery' | 'webhook';
}>;

type BusinessRecord = Readonly<{
  jobId: string;
  providerMessageId: string;
  artifactId: string;
}>;

type RpcMode = Readonly<{
  hangProviderAcceptedCheckpoint: boolean;
  crashBoundary: Boundary;
}>;

type GatewayMode = 'normal' | 'hang_before_provider_call' | 'hang_after_provider_acceptance';

class PersistentWorld {
  readonly jobsById = new Map<string, JobRecord>();
  readonly jobsByIntent = new Map<string, JobRecord>();
  readonly queue: QueueMessage[] = [];
  readonly artifacts = new Map<string, Readonly<{ id: string; payloadHash: string }>>();
  readonly provider = new PersistentProvider();
  readonly gatewayEntries: ProviderCall[] = [];
  readonly effectHistory: EffectEvent[] = [];
  readonly businessRecords = new Map<string, BusinessRecord>();
  readonly processIds = new Set<string>();
  effect: BackgroundJobWorkerEffect | null = null;
  leaseOwner: string | null = null;
  archiveTransitions = 0;
  businessFinaliseAttempts = 0;
  businessMutations = 0;
  webhookReconciliations = 0;
  private processSequence = 0;

  nextProcessId(prefix: 'api' | 'worker'): string {
    this.processSequence += 1;
    const id = `${prefix}-${this.processSequence}`;
    this.processIds.add(id);
    return id;
  }

  enqueue(): JobRecord {
    const duplicate = this.jobsByIntent.get(INTENT_ID);
    if (duplicate) return duplicate;

    const job: JobRecord = { id: JOB_ID, intentId: INTENT_ID, status: 'queued' };
    this.jobsById.set(job.id, job);
    this.jobsByIntent.set(job.intentId, job);
    this.queue.push({
      id: QUEUE_MESSAGE_ID,
      jobId: job.id,
      canonicalBody: CANONICAL_QUEUE_BODY,
      archived: false,
    });
    return job;
  }

  readQueue(): QueueMessage | null {
    return this.queue.find((message) => !message.archived) ?? null;
  }

  claim(processId: string, messageId: number): boolean {
    const queued = this.queue.find((message) => message.id === messageId && !message.archived);
    if (!queued || this.leaseOwner !== null) return false;
    this.leaseOwner = processId;
    const job = this.jobsById.get(queued.jobId);
    if (!job) throw new Error('Queue message lost its durable job');
    job.status = 'active';
    return true;
  }

  assertLease(processId: string): void {
    if (this.leaseOwner !== processId) throw new Error('Process no longer owns the durable lease');
  }

  stageArtifact(processId: string): string {
    this.assertLease(processId);
    const artifactId = `artifact-${CANONICAL_DISPATCH.payloadHash}`;
    this.artifacts.set(CANONICAL_DISPATCH.payloadHash, {
      id: artifactId,
      payloadHash: CANONICAL_DISPATCH.payloadHash,
    });
    return artifactId;
  }

  observeGatewayEntry(processId: string, dispatch: DurableResendEmailDispatch): void {
    this.assertLease(processId);
    this.assertDispatchIdentity(dispatch);
    this.gatewayEntries.push({
      idempotencyKey: dispatch.idempotencyKey,
      payloadHash: dispatch.payloadHash,
      canonicalRequestBody: dispatch.canonicalRequestBody,
    });
  }

  private assertDispatchIdentity(dispatch: DurableResendEmailDispatch): void {
    if (
      dispatch.effectKey !== EFFECT_KEY ||
      dispatch.idempotencyKey !== CANONICAL_DISPATCH.idempotencyKey ||
      dispatch.payloadHash !== CANONICAL_DISPATCH.payloadHash ||
      dispatch.canonicalRequestBody !== CANONICAL_DISPATCH.canonicalRequestBody ||
      JSON.stringify(dispatch.tags) !== JSON.stringify(CANONICAL_DISPATCH.tags)
    ) {
      throw new Error('Durable dispatch identity drifted across a process boundary');
    }
  }

  private assertCheckpointIdentity(input: CheckpointInput): void {
    if (
      input.effectKey !== EFFECT_KEY ||
      input.effectKind !== 'email_dispatch' ||
      input.payloadHash !== CANONICAL_DISPATCH.payloadHash ||
      input.providerName !== RESEND_PROVIDER_NAME ||
      input.providerIdempotencyKey !== CANONICAL_DISPATCH.idempotencyKey ||
      input.providerIdempotencyExpiresAt !== CANONICAL_DISPATCH.idempotencyExpiresAt
    ) {
      throw new Error('Durable effect identity drifted across a process boundary');
    }
  }

  checkpoint(
    input: CheckpointInput,
    source: EffectEvent['source'],
  ): BackgroundJobWorkerEffect {
    this.assertCheckpointIdentity(input);
    if (this.effect && !backgroundJobEffectTransitionAllowed(this.effect.state, input.state)) {
      throw new Error(`Non-monotonic effect transition: ${this.effect.state} -> ${input.state}`);
    }

    const next: BackgroundJobWorkerEffect = {
      effectKey: input.effectKey,
      effectKind: input.effectKind,
      state: input.state,
      payloadHash: input.payloadHash,
      providerName: input.providerName ?? null,
      providerIdempotencyKey: input.providerIdempotencyKey ?? null,
      providerIdempotencyExpiresAt: input.providerIdempotencyExpiresAt ?? null,
      providerMessageId: input.providerMessageId ?? this.effect?.providerMessageId ?? null,
      safeMetadata: input.safeMetadata ?? {},
    };
    this.effect = next;
    this.effectHistory.push({
      sequence: this.effectHistory.length + 1,
      state: next.state,
      source,
    });
    return next;
  }

  rpcFor(processId: string, mode: RpcMode): BackgroundJobHandlerRpc {
    return {
      progress: async () => {
        throw new Error('Progress is outside this fault harness');
      },
      recordEffectCheckpoint: async (input) => {
        this.assertLease(processId);
        if (mode.hangProviderAcceptedCheckpoint && input.state === 'provider_accepted') {
          return hardProcessDeath<BackgroundJobWorkerEffect>(mode.crashBoundary);
        }
        return this.checkpoint(input, 'worker');
      },
      refreshEffects: async () => {
        this.assertLease(processId);
        return this.effect ? [this.effect] : [];
      },
    };
  }

  gatewayFor(
    processId: string,
    mode: GatewayMode,
    crashBoundary: Boundary,
  ): ResendEmailGateway {
    return {
      dispatchDurable: async (dispatch) => {
        this.observeGatewayEntry(processId, dispatch);
        if (mode === 'hang_before_provider_call') {
          return hardProcessDeath<ResendDispatchOutcome>(crashBoundary);
        }

        const outcome = this.provider.dispatch(dispatch);
        if (mode === 'hang_after_provider_acceptance') {
          return hardProcessDeath<ResendDispatchOutcome>(crashBoundary);
        }
        return outcome;
      },
      dispatchLegacy: async () => {
        throw new Error('The crash harness must never use legacy email dispatch');
      },
    };
  }

  reconcileAcceptedWebhook(): void {
    const delivery = this.provider.deliveries.get(CANONICAL_DISPATCH.idempotencyKey);
    if (!delivery) throw new Error('Webhook reconciliation requires provider acceptance');
    this.webhookReconciliations += 1;
    this.checkpoint({
      effectKey: EFFECT_KEY,
      effectKind: 'email_dispatch',
      state: 'provider_accepted',
      payloadHash: CANONICAL_DISPATCH.payloadHash,
      providerName: RESEND_PROVIDER_NAME,
      providerIdempotencyKey: CANONICAL_DISPATCH.idempotencyKey,
      providerIdempotencyExpiresAt: CANONICAL_DISPATCH.idempotencyExpiresAt,
      providerMessageId: delivery.messageId,
      safeMetadata: PROVIDER_ACCEPTED_EMAIL_METADATA,
    }, 'webhook');
  }

  recoverAfterHardCrash(): void {
    this.leaseOwner = null;
    if (this.effect?.state === 'dispatch_started') {
      this.checkpoint({
        effectKey: EFFECT_KEY,
        effectKind: 'email_dispatch',
        state: 'uncertain',
        payloadHash: CANONICAL_DISPATCH.payloadHash,
        providerName: RESEND_PROVIDER_NAME,
        providerIdempotencyKey: CANONICAL_DISPATCH.idempotencyKey,
        providerIdempotencyExpiresAt: CANONICAL_DISPATCH.idempotencyExpiresAt,
        safeMetadata: {
          effectKind: 'email_dispatch',
          checkpoint: 'uncertain',
          providerName: RESEND_PROVIDER_NAME,
        },
      }, 'recovery');
    }
    const job = this.jobsById.get(JOB_ID);
    if (job && job.status !== 'succeeded') job.status = 'queued';
  }

  finaliseBusiness(input: Readonly<{ providerMessageId: string }>): BusinessRecord {
    this.businessFinaliseAttempts += 1;
    const existing = this.businessRecords.get(INTENT_ID);
    if (existing) return existing;

    const artifact = this.artifacts.get(CANONICAL_DISPATCH.payloadHash);
    if (!artifact) throw new Error('Business finalisation lost the staged artifact');
    const record = {
      jobId: JOB_ID,
      providerMessageId: input.providerMessageId,
      artifactId: artifact.id,
    };
    this.businessRecords.set(INTENT_ID, record);
    this.businessMutations += 1;
    return record;
  }

  archive(processId: string, queueMessageId: number): void {
    this.assertLease(processId);
    const queued = this.queue.find((message) => message.id === queueMessageId);
    if (!queued) throw new Error('Cannot archive a missing canonical queue message');
    if (!queued.archived) {
      queued.archived = true;
      this.archiveTransitions += 1;
    }
    const job = this.jobsById.get(queued.jobId);
    if (!job) throw new Error('Cannot complete a missing durable job');
    job.status = 'succeeded';
    this.leaseOwner = null;
  }
}

class ApiProcess {
  readonly id: string;

  constructor(private readonly world: PersistentWorld) {
    this.id = world.nextProcessId('api');
  }

  async enqueue(
    crashAfterCommit: boolean,
    crashBoundary: Boundary,
  ): Promise<JobRecord> {
    const job = this.world.enqueue();
    if (crashAfterCommit) return hardProcessDeath<JobRecord>(crashBoundary);
    return job;
  }
}

class WorkerProcess {
  readonly id: string;

  constructor(private readonly world: PersistentWorld) {
    this.id = world.nextProcessId('worker');
  }

  async run(
    crashPoint: Exclude<CrashPoint, 1> | null,
    crashBoundary: Boundary,
  ): Promise<'completed' | 'no_work'> {
    const queued = this.world.readQueue();
    if (!queued) return 'no_work';
    if (crashPoint === 2) return hardProcessDeath(crashBoundary);

    if (!this.world.claim(this.id, queued.id)) return 'no_work';
    if (crashPoint === 3) return hardProcessDeath(crashBoundary);

    this.world.stageArtifact(this.id);
    if (crashPoint === 4) return hardProcessDeath(crashBoundary);

    const rpc = this.world.rpcFor(this.id, {
      hangProviderAcceptedCheckpoint: crashPoint === 7,
      crashBoundary,
    });
    const gatewayMode: GatewayMode = crashPoint === 5
      ? 'hang_before_provider_call'
      : crashPoint === 6
        ? 'hang_after_provider_acceptance'
        : 'normal';
    const acceptance = await dispatchDurableEmailEffect({
      jobId: JOB_ID,
      effectKey: EFFECT_KEY,
      message: MESSAGE,
      effects: this.world.effect ? [this.world.effect] : [],
      rpc,
      gateway: this.world.gatewayFor(this.id, gatewayMode, crashBoundary),
      clock: persistentClock,
      signal: new AbortController().signal,
    });
    if (crashPoint === 8) return hardProcessDeath(crashBoundary);

    await finaliseDurableEmailEffect({
      acceptance,
      rpc,
      finalise: async ({ providerMessageId }) => {
        const result = this.world.finaliseBusiness({ providerMessageId });
        if (crashPoint === 8.5) return hardProcessDeath(crashBoundary);
        return result;
      },
    });
    if (crashPoint === 9) return hardProcessDeath(crashBoundary);

    this.world.archive(this.id, queued.id);
    if (crashPoint === 10) return hardProcessDeath(crashBoundary);
    return 'completed';
  }
}

function expectCanonicalTerminalState(
  world: PersistentWorld,
  expectedBusinessFinaliseAttempts = 1,
): void {
  expect(world.jobsById.size).toBe(1);
  expect(world.jobsByIntent.size).toBe(1);
  expect(world.jobsByIntent.get(INTENT_ID)).toBe(world.jobsById.get(JOB_ID));
  expect(world.jobsById.get(JOB_ID)).toMatchObject({
    id: JOB_ID,
    intentId: INTENT_ID,
    status: 'succeeded',
  });

  expect(world.queue).toEqual([{
    id: QUEUE_MESSAGE_ID,
    jobId: JOB_ID,
    canonicalBody: CANONICAL_QUEUE_BODY,
    archived: true,
  }]);
  expect(world.archiveTransitions).toBe(1);
  expect(world.artifacts.size).toBe(1);

  expect(world.provider.deliveries.size).toBe(1);
  expect(world.provider.deliveries.get(CANONICAL_DISPATCH.idempotencyKey)).toEqual({
    idempotencyKey: CANONICAL_DISPATCH.idempotencyKey,
    payloadHash: CANONICAL_DISPATCH.payloadHash,
    canonicalRequestBody: CANONICAL_DISPATCH.canonicalRequestBody,
    messageId: PROVIDER_MESSAGE_ID,
  });
  expect(new Set(world.provider.calls.map((call) => call.idempotencyKey))).toEqual(
    new Set([CANONICAL_DISPATCH.idempotencyKey]),
  );
  expect(new Set(world.provider.calls.map((call) => call.payloadHash))).toEqual(
    new Set([CANONICAL_DISPATCH.payloadHash]),
  );
  expect(new Set(world.provider.calls.map((call) => call.canonicalRequestBody))).toEqual(
    new Set([CANONICAL_DISPATCH.canonicalRequestBody]),
  );
  expect(new Set(world.gatewayEntries.map((entry) => JSON.stringify(entry))).size).toBe(1);

  expect(world.businessRecords).toEqual(new Map([[INTENT_ID, {
    jobId: JOB_ID,
    providerMessageId: PROVIDER_MESSAGE_ID,
    artifactId: `artifact-${CANONICAL_DISPATCH.payloadHash}`,
  }]]));
  expect(world.businessFinaliseAttempts).toBe(expectedBusinessFinaliseAttempts);
  expect(world.businessMutations).toBe(1);

  expect(world.effect).toMatchObject({
    effectKey: EFFECT_KEY,
    state: 'finalised',
    payloadHash: CANONICAL_DISPATCH.payloadHash,
    providerIdempotencyKey: CANONICAL_DISPATCH.idempotencyKey,
    providerMessageId: PROVIDER_MESSAGE_ID,
  });
  expect(world.effectHistory.map((event) => event.sequence)).toEqual(
    world.effectHistory.map((_, index) => index + 1),
  );
  for (let index = 1; index < world.effectHistory.length; index += 1) {
    const previous = world.effectHistory[index - 1];
    const next = world.effectHistory[index];
    expect(backgroundJobEffectTransitionAllowed(previous.state, next.state)).toBe(true);
  }
  expect(world.effectHistory.filter((event) => event.state === 'finalised')).toHaveLength(1);
  expect(world.effectHistory.at(-1)?.state).toBe('finalised');
}

describe('durable email effect hard-crash recovery', () => {
  it.each(CRASH_POINTS)(
    'survives crash point $id: $label',
    async ({ id: crashPoint }) => {
      const world = new PersistentWorld();
      const crashBoundary = boundary();
      let abandonedAttempt: Promise<unknown>;

      if (crashPoint === 1) {
        abandonedAttempt = new ApiProcess(world).enqueue(true, crashBoundary);
      } else {
        await new ApiProcess(world).enqueue(false, boundary());
        abandonedAttempt = new WorkerProcess(world).run(crashPoint, crashBoundary);
      }

      let abandonedAttemptSettled = false;
      void abandonedAttempt.then(
        () => { abandonedAttemptSettled = true; },
        () => { abandonedAttemptSettled = true; },
      );
      await crashBoundary.promise;
      await Promise.resolve();
      expect(abandonedAttemptSettled).toBe(false);

      if (crashPoint === 7) world.reconcileAcceptedWebhook();
      world.recoverAfterHardCrash();

      const retriedJob = await new ApiProcess(world).enqueue(false, boundary());
      expect(retriedJob.id).toBe(JOB_ID);

      const recoveryResult = await new WorkerProcess(world).run(null, boundary());
      expect(recoveryResult).toBe(crashPoint === 10 ? 'no_work' : 'completed');

      expectCanonicalTerminalState(world, crashPoint === 8.5 ? 2 : 1);
      if (crashPoint === 5) {
        expect(world.gatewayEntries).toHaveLength(2);
        expect(world.provider.calls).toHaveLength(1);
      } else if (crashPoint === 6) {
        expect(world.gatewayEntries).toHaveLength(2);
        expect(world.provider.calls).toHaveLength(2);
        expect(world.provider.deliveries).toHaveLength(1);
      } else {
        expect(world.provider.calls).toHaveLength(1);
      }
      expect(world.webhookReconciliations).toBe(crashPoint === 7 ? 1 : 0);

      const providerCallsAtTerminal = world.provider.calls.length;
      const gatewayEntriesAtTerminal = world.gatewayEntries.length;
      const terminalProbe = await new WorkerProcess(world).run(null, boundary());
      expect(terminalProbe).toBe('no_work');
      expect(world.provider.calls).toHaveLength(providerCallsAtTerminal);
      expect(world.gatewayEntries).toHaveLength(gatewayEntriesAtTerminal);
      expect(world.archiveTransitions).toBe(1);
    },
  );
});
