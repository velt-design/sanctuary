import { describe, expect, it } from 'vitest';
import { projectWorkSystemCommandId } from './systemCommandId';

describe('project work system command IDs', () => {
  it('is deterministic, scoped, and UUID shaped', () => {
    const first = projectWorkSystemCommandId('quote-sent', 'intent-1');
    expect(first).toBe(projectWorkSystemCommandId('quote-sent', 'intent-1'));
    expect(first).not.toBe(projectWorkSystemCommandId('quote-resent', 'intent-1'));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
