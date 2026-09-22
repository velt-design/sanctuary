import { describe, expect, it } from 'vitest';
import { initialFilters, readSavedExample, selectExample } from './clarityExample';

describe('Foundation example evidence', () => {
  it('partitions the period and keeps unknown records inspectable', () => {
    const all = selectExample(initialFilters, 'ready');
    expect(all.rows).toHaveLength(12);
    expect(all.sources.reduce((total, source) => total + source.count, 0)).toBe(all.rows.length);
    const unknown = selectExample({ days: '7', source: 'Unknown' }, 'ready');
    expect(unknown.rows.map(row => row.id)).toEqual(['DEMO-03']);
    expect(unknown.known).toBe(0);
    expect(unknown.sources.reduce((total, source) => total + source.count, 0)).toBe(4);
    expect(selectExample(initialFilters, 'empty').rows).toEqual([]);
  });
  it('restores only supported preferences and discards unrelated stored fields', () => {
    expect(readSavedExample('{"days":"7","source":"Meta","record":"private"}')).toEqual({ days: '7', source: 'Meta' });
    for (const value of [null, '{', '{"days":"999","source":"Google"}', '{"days":"7","source":"other"}']) expect(readSavedExample(value)).toBeNull();
  });
});
