import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectReads from './ProjectReads';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });
it('serves only the exact fictional booklet read, fails once and rejects every write', async () => {
  vi.useFakeTimers(); window.history.replaceState(null, '', '/?readFailure=1');
  const original = vi.fn(); vi.stubGlobal('fetch', original);
  const view = renderIntoDocument(<ProjectReads projectId="proj_progressive_a"><p>Actual child</p></ProjectReads>);
  const path = '/api/staff/v1/projects/proj_progressive_a/design-booklet';
  const failed = window.fetch(path); await act(async () => vi.advanceTimersByTimeAsync(1400)); expect((await failed).status).toBe(503);
  const recovered = window.fetch(path); await act(async () => vi.advanceTimersByTimeAsync(1400));
  expect((await (await recovered).json()).snapshot.project.id).toBe('proj_progressive_a');
  expect((await window.fetch(path, { method: 'PUT' })).status).toBe(403);
  expect((await window.fetch('/api/staff/v1/projects/real/design-booklet')).status).toBe(403);
  expect((await window.fetch(path + '/pdf', { method: 'POST' })).status).toBe(403);
  expect(original).not.toHaveBeenCalled(); view.unmount(); expect(window.fetch).toBe(original);
});
