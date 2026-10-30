import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createStudioReviewDiagnostics } from './studioReviewDiagnostics.server';

beforeEach(() => { delete process.env.STUDIO_REQUEST_DIAGNOSTICS; });
afterEach(() => { vi.restoreAllMocks(); delete process.env.STUDIO_REQUEST_DIAGNOSTICS; });

it('uses the Review route and same server-owned correlation without enabling detailed logs by default', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const diagnostics = createStudioReviewDiagnostics(), value = { private: 'not a log input' };
  expect(await diagnostics.measure('target', () => value)).toBe(value);
  const response = Response.json(value); diagnostics.apply(response); diagnostics.finish('response', 200);
  expect(response.headers.get('x-portal-request-id')).toBe(diagnostics.context.requestId);
  expect(response.headers.get('server-timing')).toMatch(/^total;dur=\d+\.\d$/);
  expect(diagnostics.context.route).toBe('/api/projects/[projectId]/estimates/[estimateId]/studio-review');
  expect(await response.json()).toEqual(value); expect(warn).not.toHaveBeenCalled();
});

it('emits one bounded scalar summary and preserves thrown data errors', async () => {
  process.env.STUDIO_REQUEST_DIAGNOSTICS = '1';
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), diagnostics = createStudioReviewDiagnostics();
  const error = Error('private customer token payload');
  await expect(diagnostics.measure('target', () => { throw error; })).rejects.toBe(error);
  for (let i = 0; i < 20; i++) await diagnostics.measure('projection', () => ({ private: 'secret' }));
  const response = new Response('kept', { status: 503 }); diagnostics.apply(response);
  diagnostics.finish('failure', 503); diagnostics.finish('response', 200);
  expect(warn).toHaveBeenCalledTimes(1);
  const entry = warn.mock.calls[0][1] as any;
  expect(entry.requestId).toBe(response.headers.get('x-portal-request-id'));
  expect(entry.route).toBe(diagnostics.context.route); expect(entry.status).toBe(503);
  expect(entry.event).toBe('studio.review_diagnostics'); expect(entry.outcome).toBe('failure');
  expect(entry.stages).toHaveLength(14); expect(entry.stages[0].state).toBe('rejected');
  for (const stage of entry.stages) expect(Object.keys(stage).sort()).toEqual(['durationMs', 'stage', 'startMs', 'state']);
  expect(JSON.stringify(entry)).not.toMatch(/private|secret|token|payload/); expect(await response.text()).toBe('kept');
});

it('does not change data or refusal behavior when logging fails', async () => {
  process.env.STUDIO_REQUEST_DIAGNOSTICS = '1'; vi.spyOn(console, 'warn').mockImplementation(() => { throw Error('log unavailable'); });
  const diagnostics = createStudioReviewDiagnostics(), response = new Response('refused', { status: 401 });
  expect(await diagnostics.measure('guard', () => false)).toBe(false);
  diagnostics.apply(response); expect(() => diagnostics.finish('response', 401)).not.toThrow();
  expect(response.status).toBe(401); expect(await response.text()).toBe('refused');
});
