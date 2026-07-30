import { describe, expect, it, vi } from 'vitest';
import { projectCommandIntent, StableCommandAttempt } from './stableCommandAttempt';

describe('StableCommandAttempt', () => {
  it('reuses an ambiguous attempt and rotates only after commit or an intent change', () => {
    const createId = vi.fn()
      .mockReturnValueOnce('command-1')
      .mockReturnValueOnce('command-2')
      .mockReturnValueOnce('command-3');
    const attempts = new StableCommandAttempt(createId);
    const first = projectCommandIntent('CREATE', { title: 'Email customer', dueAt: 'tomorrow' });
    const same = projectCommandIntent('CREATE', { dueAt: 'tomorrow', title: 'Email customer' });
    const changed = projectCommandIntent('CREATE', { title: 'Email customer', dueAt: 'Friday' });

    expect(attempts.commandIdFor(first)).toBe('command-1');
    expect(attempts.commandIdFor(same)).toBe('command-1');
    expect(attempts.commandIdFor(changed)).toBe('command-2');
    attempts.committed(changed);
    expect(attempts.commandIdFor(changed)).toBe('command-3');
  });
});
