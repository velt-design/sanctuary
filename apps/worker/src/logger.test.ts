import { describe, expect, it } from 'vitest';

import { createWorkerLogger, sanitizeWorkerLogFields, type SafeWorkerLogFields } from './logger';

function destination() {
  const chunks: string[] = [];
  return { chunks, write: (chunk: string) => chunks.push(chunk) };
}

describe('worker logger', () => {
  const providerCredentialShape = ['sk', 'live', 'abcdefghijklmnopqrstuvwxyz'].join('_');

  it('writes one-line structured JSON with allowlisted safe fields', () => {
    const stdout = destination();
    const logger = createWorkerLogger({
      stdout,
      now: () => new Date('2026-07-20T01:02:03.000Z'),
    });

    logger.info('worker_started', {
      workerId: 'worker-1',
      mode: 'dark',
      activeJobCount: 0,
      acceptingJobs: false,
    });

    expect(JSON.parse(stdout.chunks.join(''))).toEqual({
      timestamp: '2026-07-20T01:02:03.000Z',
      level: 'info',
      event: 'worker_started',
      workerId: 'worker-1',
      mode: 'dark',
      activeJobCount: 0,
      acceptingJobs: false,
    });
  });

  it('drops unknown, raw-error, and sensitive values at runtime', () => {
    const unsafeFields = {
      workerId: 'worker-1',
      recipient: 'person@example.com',
      url: 'https://example.com/?token=secret',
      error: new Error('Bearer secret'),
      errorCode: 'provider said person@example.com',
      phase: providerCredentialShape,
      reason: 'john.smith',
    } as unknown as SafeWorkerLogFields;

    expect(sanitizeWorkerLogFields(unsafeFields)).toEqual({ workerId: 'worker-1' });
  });

  it('uses a fixed event when the supplied event is not a safe code', () => {
    const stdout = destination();
    const logger = createWorkerLogger({ stdout });

    logger.info('person@example.com');

    expect(JSON.parse(stdout.chunks[0] ?? '{}').event).toBe('worker_log_event_rejected');
  });

  it.each([
    providerCredentialShape,
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue',
    '0123456789abcdef0123456789abcdef',
    'person.example.com',
    'john.smith',
  ])('rejects sensitive-looking or non-worker event value %s', (event) => {
    const stdout = destination();
    createWorkerLogger({ stdout }).info(event);
    expect(JSON.parse(stdout.chunks[0] ?? '{}').event).toBe('worker_log_event_rejected');
  });

  it('keeps error records on stderr and honours the minimum level', () => {
    const stdout = destination();
    const stderr = destination();
    const logger = createWorkerLogger({ stdout, stderr, minimumLevel: 'warn' });

    logger.info('not_written');
    logger.warn('warning_written');
    logger.error('error_written', { errorCode: 'RPC_FAILED' });

    expect(stdout.chunks).toHaveLength(1);
    expect(stderr.chunks).toHaveLength(1);
  });
});
