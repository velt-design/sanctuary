import { describe, expect, it, vi } from 'vitest';
import { loadWorkbenchPageRead } from './loadWorkbenchPageRead.server';
import { workbenchProjectMatches, type WorkbenchRouteContext } from './workbenchPageRead';
import type { EstimateDetail } from '@/lib/estimates/types';
import { PostgrestError } from '@supabase/supabase-js';

const context = { kind: 'ready', project: { id: 'proj_1', name: 'Fictional project', siteAddress: null }, estimate: { id: 'est_1' } } as WorkbenchRouteContext;
describe('request-owned Workbench source parts', () => {
  it.each(['42501', 'PGRST301', 'PGRST302', 'PGRST303', 'PT401', 'PT403', 'PT404'])('clears explicit status-less authority code %s at both context and detail boundaries', async (code) => {
    const error = new PostgrestError({ code, message: 'Private authority detail', details: '', hint: '' });
    expect(error).not.toHaveProperty('status');
    for (const site of ['context', 'detail']) {
      const readers = { context: vi.fn(async () => { if (site === 'context') throw error; return context; }), estimate: vi.fn(async (): Promise<EstimateDetail | null> => { throw error; }) };
      const read = loadWorkbenchPageRead({ projectId: 'proj_1' }, readers);
      expect(await read.estimate).toEqual({ kind: 'error', accessEnded: true, message: 'The selected workbench data could not be loaded. Retry the read.' });
      if (site === 'context') { expect(await read.context).toMatchObject({ kind: 'error', accessEnded: true }); expect(readers.estimate).not.toHaveBeenCalled(); }
    }
  });
  it.each(['08006', '57014', 'XX000', 'PGRST000', 'PGRST202', 'PGRST300', '42P01', 'unknown'])('retains transient/schema/unknown code %s without message-based authority guessing', async (code) => {
    const error = new PostgrestError({ code, message: 'JWT permission denied in a private diagnostic', details: '', hint: '' });
    for (const site of ['context', 'detail']) {
      const read = loadWorkbenchPageRead({ projectId: 'proj_1' }, { context: async () => { if (site === 'context') throw error; return context; }, estimate: async () => { throw error; } });
      expect(await read.estimate).toMatchObject({ kind: 'error', accessEnded: false });
    }
  });
  it('shares exactly one context and starts only its authoritative estimate after selection', async () => {
    let resolve!: (value: WorkbenchRouteContext) => void;
    const readers = { context: vi.fn(() => new Promise<WorkbenchRouteContext>((accept) => { resolve = accept; })), estimate: vi.fn(async () => ({ id: 'est_1', projectId: 'proj_1' } as EstimateDetail)) };
    const read = loadWorkbenchPageRead({ projectId: 'proj_1' }, readers);
    expect(readers.context).toHaveBeenCalledOnce(); expect(readers.estimate).not.toHaveBeenCalled();
    resolve(context); expect(await read.context).toEqual({ kind: 'context', context });
    expect(await read.estimate).toMatchObject({ kind: 'estimate', estimate: { id: 'est_1' } });
    expect(readers.estimate).toHaveBeenCalledExactlyOnceWith('proj_1', 'est_1');
  });
  it('rejects mismatched records and carries authority-ending failures without running a replacement read', async () => {
    const readers = { context: vi.fn(async () => context), estimate: vi.fn(async () => ({ id: 'est_other', projectId: 'proj_2' } as EstimateDetail)) };
    expect(await loadWorkbenchPageRead({ projectId: 'proj_1' }, readers).estimate).toMatchObject({ kind: 'error', accessEnded: true });
    readers.context.mockRejectedValueOnce({ status: 403 }); readers.estimate.mockClear();
    const denied = loadWorkbenchPageRead({ projectId: 'proj_1' }, readers);
    expect(await denied.context).toMatchObject({ kind: 'error', accessEnded: true });
    expect(await denied.estimate).toMatchObject({ kind: 'error', accessEnded: true }); expect(readers.estimate).not.toHaveBeenCalled();
    expect(workbenchProjectMatches('proj_11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(workbenchProjectMatches('proj_1', 'proj_2')).toBe(false);
  });
});
