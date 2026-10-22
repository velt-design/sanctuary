import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), ensureFolder: vi.fn(), resolvePath: vi.fn(), createGraph: vi.fn(), config: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabaseServiceRole: { rpc: mocks.rpc } }));
vi.mock('./config', async () => ({ ...await vi.importActual('./config'), sharePointConfig: mocks.config }));
vi.mock('./graph', () => ({ createGraph: mocks.createGraph }));
import { provisionProjectFolder } from './provision';
const project = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ binding: 'binding', enquiriesItemId: 'enquiries', provisionEnabled: true });
  mocks.rpc.mockImplementation(async (_name, input) => ({ data: input.p_action === 'claim' ? { claimed: true, projectId: project, folderName: `Fixture - ${project}`, year: '2026', parentId: 'enquiries' } : { completed: true }, error: null }));
  mocks.createGraph.mockResolvedValue({ ensureFolder: mocks.ensureFolder, resolvePath: mocks.resolvePath });
  mocks.resolvePath.mockResolvedValue({ id: 'enquiries' });
  mocks.ensureFolder.mockImplementation(async (_parent, name) => ({ id: name === '2026' ? 'year' : name.startsWith('Fixture') ? 'project-root' : name }));
});
it('publishes a binding only after all standard folders exist', async () => {
  expect(await provisionProjectFolder('assertion')).toEqual({ updated: true });
  expect(mocks.ensureFolder.mock.calls).toEqual([['enquiries', '2026'], ['year', `Fixture - ${project}`], ['project-root', '3 CAD'], ['project-root', '4 RENDERING'], ['project-root', '5 DESIGN PACKAGE']]);
  expect(mocks.rpc.mock.calls[1][1]).toMatchObject({ p_action: 'complete', p_project_id: project, p_input: { itemId: 'project-root' } });
});
it('records failure after a partial create and safely retries the same names', async () => {
  mocks.ensureFolder.mockRejectedValueOnce(new Error('provider failed'));
  await expect(provisionProjectFolder('assertion')).rejects.toMatchObject({ code: 'source_unavailable' });
  expect(mocks.rpc.mock.calls[1][1].p_action).toBe('fail');
  await provisionProjectFolder('assertion');
  expect(mocks.ensureFolder.mock.calls[0]).toEqual(mocks.ensureFolder.mock.calls[1]);
});
it('does not touch Microsoft while disabled or another worker owns the lease', async () => {
  mocks.config.mockReturnValueOnce({ provisionEnabled: false });
  expect(await provisionProjectFolder('')).toMatchObject({ reason: 'disabled' });
  mocks.rpc.mockResolvedValueOnce({ data: { claimed: false, reason: 'empty' } });
  expect(await provisionProjectFolder('')).toMatchObject({ reason: 'empty' });
  expect(mocks.createGraph).not.toHaveBeenCalled();
});
it('rejects a misconfigured intake folder before any provider writes', async () => {
  mocks.resolvePath.mockResolvedValue({ id: 'other' });
  await expect(provisionProjectFolder('assertion')).rejects.toMatchObject({ code: 'source_invalid' });
  expect(mocks.ensureFolder).not.toHaveBeenCalled();
});
