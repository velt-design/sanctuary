import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/repo/apiClient';
import { isProjectWorkUnavailableError } from './client';

describe('Project Work client errors', () => {
  it('recognises only the stable V2 unavailable contract', () => {
    expect(isProjectWorkUnavailableError(new ApiError('Unavailable', {
      status: 503,
      body: { code: 'WORK_ITEMS_UNAVAILABLE' },
    }))).toBe(true);
    expect(isProjectWorkUnavailableError(new ApiError('Other service failure', {
      status: 503,
      body: { code: 'COMMAND_FAILED' },
    }))).toBe(false);
    expect(isProjectWorkUnavailableError(new ApiError('Unauthorized', {
      status: 401,
      body: { code: 'WORK_ITEMS_UNAVAILABLE' },
    }))).toBe(false);
  });
});
