import { afterEach, expect, it, vi } from 'vitest';
import { measureProjectFilesPhase } from './timing';
afterEach(() => vi.restoreAllMocks());

it('does not change an operation result or original error when observation throws or rejects', async () => {
  const result = { source: 'synthetic' }, original = new Error('original failure');
  for (const observer of [() => { throw new Error('observer failure'); }, async () => { throw new Error('observer rejection'); }]) {
    const work = vi.fn(async () => result);
    expect(await measureProjectFilesPhase('children', observer, work)).toBe(result);
    expect(work).toHaveBeenCalledTimes(1);
    await expect(measureProjectFilesPhase('children', observer, async () => { throw original; })).rejects.toBe(original);
  }
});

it('skips invalid clocks and leaves unobserved callers free of timing work', async () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(NaN), observer = vi.fn();
  expect(await measureProjectFilesPhase('token', undefined, async () => 'result')).toBe('result');
  expect(clock).not.toHaveBeenCalled();
  expect(await measureProjectFilesPhase('token', observer, async () => 'result')).toBe('result');
  expect(observer).not.toHaveBeenCalled();
  clock.mockImplementation(() => { throw new Error('clock failure'); });
  expect(await measureProjectFilesPhase('token', observer, async () => 'result')).toBe('result');
});
