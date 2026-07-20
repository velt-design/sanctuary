import { getBackgroundJobDefinition, type BackgroundJobConcurrencyClass, type BackgroundJobKind } from '@sp/jobs';

type WaitingPermit = {
  readonly kind: BackgroundJobKind;
  readonly concurrencyClass: BackgroundJobConcurrencyClass;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
  readonly signal?: AbortSignal;
  onAbort?: () => void;
};

type BackgroundJobConcurrencyLimits = Readonly<{
  global: number;
  byClass?: Readonly<Partial<Record<BackgroundJobConcurrencyClass, number>>>;
  byKind?: Readonly<Partial<Record<BackgroundJobKind, number>>>;
}>;

function assertPositiveLimit(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new RangeError(`${name} must be an integer between 1 and 100`);
  }
}

export class BackgroundJobConcurrencyController {
  readonly #limits: BackgroundJobConcurrencyLimits;
  readonly #activeByClass = new Map<BackgroundJobConcurrencyClass, number>();
  readonly #activeByKind = new Map<BackgroundJobKind, number>();
  readonly #waiters: WaitingPermit[] = [];
  #active = 0;

  constructor(limits: BackgroundJobConcurrencyLimits) {
    assertPositiveLimit('Global concurrency', limits.global);
    for (const [concurrencyClass, limit] of Object.entries(limits.byClass ?? {})) {
      if (limit !== undefined) assertPositiveLimit(`${concurrencyClass} concurrency`, limit);
    }
    for (const [kind, limit] of Object.entries(limits.byKind ?? {})) {
      if (limit !== undefined) assertPositiveLimit(`${kind} concurrency`, limit);
    }
    this.#limits = limits;
  }

  get activeCount(): number {
    return this.#active;
  }

  get availableGlobalCount(): number {
    return Math.max(0, this.#limits.global - this.#active);
  }

  async run<T>(kind: BackgroundJobKind, signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
    await this.#acquire(kind, signal);
    try {
      return await work();
    } finally {
      this.#release(kind);
    }
  }

  #canAcquire(kind: BackgroundJobKind, concurrencyClass: BackgroundJobConcurrencyClass): boolean {
    if (this.#active >= this.#limits.global) return false;
    const classLimit = this.#limits.byClass?.[concurrencyClass] ?? this.#limits.global;
    if ((this.#activeByClass.get(concurrencyClass) ?? 0) >= classLimit) return false;
    const kindLimit = this.#limits.byKind?.[kind] ?? classLimit;
    return (this.#activeByKind.get(kind) ?? 0) < kindLimit;
  }

  #claimPermit(kind: BackgroundJobKind, concurrencyClass: BackgroundJobConcurrencyClass): void {
    this.#active += 1;
    this.#activeByClass.set(concurrencyClass, (this.#activeByClass.get(concurrencyClass) ?? 0) + 1);
    this.#activeByKind.set(kind, (this.#activeByKind.get(kind) ?? 0) + 1);
  }

  #acquire(kind: BackgroundJobKind, signal?: AbortSignal): Promise<void> {
    const concurrencyClass = getBackgroundJobDefinition(kind).concurrencyClass;
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (this.#canAcquire(kind, concurrencyClass)) {
      this.#claimPermit(kind, concurrencyClass);
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: WaitingPermit = { kind, concurrencyClass, resolve, reject, signal };
      waiter.onAbort = () => {
        const index = this.#waiters.indexOf(waiter);
        if (index >= 0) this.#waiters.splice(index, 1);
        reject(signal?.reason);
      };
      signal?.addEventListener('abort', waiter.onAbort, { once: true });
      this.#waiters.push(waiter);
    });
  }

  #release(kind: BackgroundJobKind): void {
    const concurrencyClass = getBackgroundJobDefinition(kind).concurrencyClass;
    this.#active -= 1;
    this.#activeByClass.set(concurrencyClass, (this.#activeByClass.get(concurrencyClass) ?? 1) - 1);
    this.#activeByKind.set(kind, (this.#activeByKind.get(kind) ?? 1) - 1);
    this.#dispatchWaiters();
  }

  #dispatchWaiters(): void {
    let index = 0;
    while (index < this.#waiters.length && this.#active < this.#limits.global) {
      const waiter = this.#waiters[index];
      if (waiter.signal?.aborted) {
        this.#waiters.splice(index, 1);
        waiter.reject(waiter.signal.reason);
        continue;
      }
      if (!this.#canAcquire(waiter.kind, waiter.concurrencyClass)) {
        index += 1;
        continue;
      }
      this.#waiters.splice(index, 1);
      waiter.signal?.removeEventListener('abort', waiter.onAbort!);
      this.#claimPermit(waiter.kind, waiter.concurrencyClass);
      waiter.resolve();
    }
  }
}
