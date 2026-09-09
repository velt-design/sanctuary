import { describe, expect, it, vi } from 'vitest';
import { createScheduleMutationCheckpoint } from './scheduleMutationCheckpoint';

describe('schedule save checkpoint', () => {
  it('rolls a rejected edit back once', () => {
    const rollback = vi.fn();
    const checkpoint = createScheduleMutationCheckpoint();
    checkpoint.prepare(rollback);
    checkpoint.rollback();
    checkpoint.rollback();
    expect(rollback).toHaveBeenCalledTimes(1);
  });
  it('never rolls an accepted edit back if later work fails', () => {
    const rollback = vi.fn();
    const checkpoint = createScheduleMutationCheckpoint();
    checkpoint.prepare(rollback);
    checkpoint.accept();
    checkpoint.rollback();
    expect(checkpoint.accepted).toBe(true);
    expect(rollback).not.toHaveBeenCalled();
  });
});
