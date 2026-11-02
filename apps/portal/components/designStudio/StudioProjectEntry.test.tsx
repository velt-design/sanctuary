import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import StudioProjectEntry from './StudioProjectEntry';
import { rememberStudioProjectChoice, type StudioProjectDesigns } from '@/lib/designStudio/projectDesigns';
const mocks = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), create: vi.fn(), auth: { status: 'authenticated', user: { id: 'actor' }, role: 'staff' } as any }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => mocks.auth }));
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: mocks.api }));
vi.mock('@/lib/designStudio/studioDocumentNavigation', () => ({ navigateStudioDocument: mocks.navigate }));
vi.mock('./StudioCreateAction', () => ({ default: (props: any) => { mocks.create(props); return <p>Creating first design</p>; } }));
const projectId = 'proj_10000000-0000-4000-8000-000000000001';
const data = (ids: string[] = []): StudioProjectDesigns => ({ project: { id: projectId.slice(5), name: 'Synthetic courtyard' }, loadError: false, designs: ids.map(id => ({ id, label: id, versionLabel: 'V1', createdAt: '', history: 'Current draft', quoteLabel: null, canOpenEditor: true, status: 'draft', commercialScopeId: null, isActiveDraft: true })) });
let mounted: ReturnType<typeof renderIntoDocument>;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.auth = { status: 'authenticated', user: { id: 'actor' }, role: 'staff' }; mocks.navigate.mockResolvedValue(undefined); });
afterEach(() => mounted?.unmount());
async function mount(initial = data(), mode: 'current' | 'option' | 'add-on' = 'current') { await act(async () => { mounted = renderIntoDocument(<StudioProjectEntry projectId={projectId} actorId="actor" initial={initial} mode={mode} />); }); }
it('returns directly to the remembered editable design with no creation or landing form', async () => {
  rememberStudioProjectChoice('actor', projectId, 'option'); await mount(data(['current', 'option']));
  expect(mocks.navigate).toHaveBeenCalledWith(`/staff/design-studio/${projectId}/option/edit`, true, undefined, expect.any(AbortSignal));
  expect(mocks.create).not.toHaveBeenCalled(); expect(mounted.container.querySelector('input,fieldset')).toBeNull();
});
it('returns quoted choices to the actual read-only design without starting a revision', async () => {
  const initial = data(['quoted']); initial.designs[0].canOpenEditor = false; await mount(initial);
  expect(mocks.navigate.mock.calls[0][0]).toBe(`/staff/design-studio/${projectId}/quoted/edit`); expect(mocks.create).not.toHaveBeenCalled();
});
it('starts a sensible default only for confirmed empty inventory, then rechecks inside the creation lock', async () => {
  await mount(); const props = mocks.create.mock.calls.at(-1)![0];
  expect(props).toMatchObject({ automatic: 'first', openOnCreated: true, intent: { mode: 'blank', scope: 'base', internalName: 'Design 1' } });
  mocks.api.mockResolvedValue({ ...data(['another-tab']), projectId });
  expect(await props.beforeCreate()).toBe(false);
  expect(mocks.api.mock.calls[0][1].cache).toBe('no-store');
  expect(mocks.navigate.mock.calls[0][0]).toBe(`/staff/design-studio/${projectId}/another-tab/edit`);
});
it.each(['option', 'add-on'] as const)('keeps deliberate %s creation inside Studio without asking scope or name upfront', async mode => {
  await mount(data(['saved']), mode); const props = mocks.create.mock.calls.at(-1)![0];
  expect(props.automatic).toBe('new'); expect(props.intent.scope).toBe(mode === 'add-on' ? 'add_on' : 'base');
  mocks.api.mockResolvedValue({ ...data(['saved']), projectId }); expect(await props.beforeCreate()).toBe(true);
});
it('retries failed inventory without creating a blank and rejects wrong-project refreshed inventory', async () => {
  await mount({ ...data(), loadError: true }); expect(mocks.create).not.toHaveBeenCalled(); expect(mounted.container.textContent).toContain('Nothing new has been created');
  mocks.api.mockResolvedValue({ ...data(['saved']), projectId }); await act(async () => mounted.container.querySelector('button')!.click());
  expect(mocks.navigate).toHaveBeenCalledOnce(); expect(mocks.create).not.toHaveBeenCalled();
  mounted.unmount(); await mount(); const props = mocks.create.mock.calls.at(-1)![0]; mocks.api.mockResolvedValue({ ...data(), projectId: 'other-project' });
  await expect(props.beforeCreate()).rejects.toThrow();
});
it('never creates or opens with a different actor or unsupported role', async () => {
  mocks.auth = { status: 'authenticated', user: { id: 'other' }, role: 'staff' }; await mount(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
});
