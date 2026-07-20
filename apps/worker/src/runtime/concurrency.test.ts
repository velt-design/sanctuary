import { describe, expect, it, vi } from 'vitest';

import { BackgroundJobConcurrencyController } from './concurrency';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('BackgroundJobConcurrencyController', () => {
  it('enforces global, class, and kind limits while allowing independent classes', async () => {
    const controller = new BackgroundJobConcurrencyController({
      global: 2,
      byClass: { email: 1, orchestration: 1 },
      byKind: { quote_send: 1 },
    });
    const quoteGate = deferred();
    const automationGate = deferred();
    const starts: string[] = [];

    const firstQuote = controller.run('quote_send', undefined, async () => {
      starts.push('quote_send');
      await quoteGate.promise;
    });
    const secondEmail = controller.run('quote_resend', undefined, async () => {
      starts.push('quote_resend');
    });
    const automation = controller.run('automation_event', undefined, async () => {
      starts.push('automation_event');
      await automationGate.promise;
    });
    await vi.waitFor(() => expect(starts).toEqual(['quote_send', 'automation_event']));
    expect(controller.activeCount).toBe(2);

    quoteGate.resolve();
    await firstQuote;
    await secondEmail;
    expect(starts).toEqual(['quote_send', 'automation_event', 'quote_resend']);
    expect(controller.activeCount).toBe(1);

    automationGate.resolve();
    await automation;
    expect(controller.activeCount).toBe(0);
  });

  it('removes an aborted waiter without consuming a permit', async () => {
    const controller = new BackgroundJobConcurrencyController({ global: 1, byClass: { email: 1 } });
    const gate = deferred();
    const active = controller.run('quote_send', undefined, () => gate.promise);
    await vi.waitFor(() => expect(controller.activeCount).toBe(1));

    const abortController = new AbortController();
    const waiting = controller.run('quote_resend', abortController.signal, async () => undefined);
    const reason = new Error('test abort');
    abortController.abort(reason);
    await expect(waiting).rejects.toBe(reason);
    expect(controller.activeCount).toBe(1);

    gate.resolve();
    await active;
    expect(controller.activeCount).toBe(0);
  });
});
