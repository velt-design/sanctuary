import type { SiteOutputV1 } from '@sp/costing';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import {
  useCalculatorCostingRequest,
  type CalculatorCostingRequester,
} from './useCalculatorCostingRequest';

type CostingRequestState = ReturnType<typeof useCalculatorCostingRequest>;

let latest: CostingRequestState | null = null;

function result(id: string): SiteOutputV1 {
  return { id } as unknown as SiteOutputV1;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function Probe({
  ready,
  payload,
  request,
}: {
  ready: boolean;
  payload: string;
  request: CalculatorCostingRequester;
}) {
  latest = useCalculatorCostingRequest({
    readyToCalculate: ready,
    requestPayloadJson: payload,
    debounceMs: 20,
    request,
  });
  return <div data-calculating={String(latest.isCalculating)} />;
}

async function startDebouncedRequest() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
}

afterEach(() => {
  latest = null;
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useCalculatorCostingRequest', () => {
  it('debounces a valid request and records the matching successful payload', async () => {
    vi.useFakeTimers();
    const request = vi.fn<CalculatorCostingRequester>().mockResolvedValue(result('latest'));
    const rendered = renderIntoDocument(<Probe ready payload={'{"length":6}'} request={request} />);

    expect(request).not.toHaveBeenCalled();
    await startDebouncedRequest();

    expect(request).toHaveBeenCalledTimes(1);
    expect(latest?.result).toEqual(result('latest'));
    expect(latest?.lastSuccessfulRequestPayloadJson).toBe('{"length":6}');
    expect(latest?.engineError).toBeNull();
    expect(latest?.isCalculating).toBe(false);
    rendered.unmount();
  });

  it('aborts an obsolete request and never lets its late result replace the newest result', async () => {
    vi.useFakeTimers();
    const first = deferred<SiteOutputV1>();
    const second = deferred<SiteOutputV1>();
    const signals: AbortSignal[] = [];
    const request = vi.fn<CalculatorCostingRequester>((_payload, signal) => {
      signals.push(signal);
      return signals.length === 1 ? first.promise : second.promise;
    });
    const rendered = renderIntoDocument(<Probe ready payload="first" request={request} />);
    await startDebouncedRequest();

    rendered.rerender(<Probe ready payload="second" request={request} />);
    expect(signals[0]?.aborted).toBe(true);
    await startDebouncedRequest();

    await act(async () => {
      second.resolve(result('second'));
      await second.promise;
    });
    expect(latest?.result).toEqual(result('second'));
    expect(latest?.lastSuccessfulRequestPayloadJson).toBe('second');

    await act(async () => {
      first.resolve(result('first'));
      await first.promise;
    });
    expect(latest?.result).toEqual(result('second'));
    expect(latest?.lastSuccessfulRequestPayloadJson).toBe('second');
    rendered.unmount();
  });

  it('retains the last valid result when a newer request fails', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn<CalculatorCostingRequester>()
      .mockResolvedValueOnce(result('valid'))
      .mockRejectedValueOnce(new Error('Costing unavailable'));
    const rendered = renderIntoDocument(<Probe ready payload="valid" request={request} />);
    await startDebouncedRequest();

    rendered.rerender(<Probe ready payload="invalid" request={request} />);
    await startDebouncedRequest();

    expect(latest?.result).toEqual(result('valid'));
    expect(latest?.lastSuccessfulRequestPayloadJson).toBe('valid');
    expect(latest?.engineError).toBe('Costing unavailable');
    expect(latest?.isCalculating).toBe(false);
    rendered.unmount();
  });
});
