import { act, type ReactNode } from 'react';
import { ProjectCommercialProvider } from '@/components/projects/ProjectPage/ProjectCommercialContext';
import { makeWebsiteFacadeCommand } from '@/lib/designStudio/websiteFacadeCommandTestFixture';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import StudioCreateAction, { type StudioCreateIntent } from './StudioCreateAction';
import StudioNewDesign from './StudioNewDesign';
import StudioRevisionStart from './StudioRevisionStart';
import type { StudioCreateCommand } from '../../lib/designStudio/createCommand';
import { makeStudioWebsiteImportTestFixture } from '../../lib/designStudio/websiteImportTestFixture';
import { parseStudioWebsiteEnrichment } from '../../lib/designStudio/websiteEnrichment';
import { parseStudioWebsiteGableEnrichment } from '../../lib/designStudio/websiteGableEnrichment';
import { invalidateStudioLifecycle, prepareStudioSignOut } from '../../lib/designStudio/studioLifecycle';
const mocks = vi.hoisted(() => ({ api:vi.fn(),navigate:vi.fn(),push:vi.fn(),policyReady: true, list: vi.fn(), send: vi.fn(), stage: vi.fn(), ack: vi.fn(), owner: vi.fn(), lock: vi.fn(), invalidate: vi.fn() }));
vi.mock('./StudioCommercialPolicy', () => ({ default: ({children}: {children: ReactNode}) => <ProjectCommercialProvider projectId="proj-one" ready={mocks.policyReady}>{children}</ProjectCommercialProvider> }));
vi.mock('next/navigation', () => ({useRouter: () => ({refresh: vi.fn(),push:mocks.push})}));
vi.mock('@/lib/repo/apiClient',()=>({apiJson:mocks.api}));
vi.mock('@/lib/designStudio/studioDocumentNavigation',()=>({navigateStudioDocument:mocks.navigate}));
const queryClient = { invalidateQueries: mocks.invalidate };
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => queryClient }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseRuntimeUrl: () => 'http://local', supabaseHostFromUrl: () => 'local' }));
vi.mock('@/lib/designStudio/createTransport', () => ({ listStudioPendingCreations: mocks.list, sendStudioCreation: mocks.send, stageStudioCreation: mocks.stage, acknowledgeStudioCreation: mocks.ack }));
vi.mock('@/lib/localFirst/store', () => ({ getLocalFirstStoreOwner: mocks.owner }));
vi.mock('idb-keyval', () => ({ keys: async () => [], get: vi.fn(), update: vi.fn() }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ user: { id: 'actor' }, role: 'staff' }) }));
const scope = { actorId: 'actor', projectId: 'proj-one' };
const receipt = { estimateId: 'est-created', designId: 'design', revision: 1, savedAt: '2026-09-24T00:00:00Z', alreadyExisted: false };
const command: StudioCreateCommand = { schemaVersion: 'studio_create.v1', requestId: 'retained-id', mode: 'clone', sourceEstimateId: 'est-source', expectedRevision: 1, expectedUpdatedAt: '2026-09-23T00:00:00Z' };
const intent: StudioCreateIntent = { mode: 'clone', sourceEstimateId: 'est-source', expectedRevision: 5, expectedUpdatedAt: '2026-09-24T00:00:00Z' };
function retained(overrides = {}) { return { key: 'journal', reference: { requestId: command.requestId }, recovery: { state: 'valid', key: 'journal', command, body: JSON.stringify(command), receipt: null, rejectedStatus: null, ...overrides } }; }
const mounted: ReturnType<typeof renderIntoDocument>[] = [];
function mount(nextIntent: StudioCreateIntent = intent) { const value = renderIntoDocument(<StudioCreateAction scope={scope} intent={nextIntent} />); mounted.push(value); return value; }
const flush = async () => { await act(async () => {}); };
const button = (label: string) => [...document.querySelectorAll('button')].find(item => item.textContent === label)!;
const click = async (label: string) => { await act(async () => { button(label).click(); }); };
beforeEach(() => {
  mocks.policyReady = true;
  invalidateStudioLifecycle();
  vi.resetAllMocks(); mocks.owner.mockReturnValue('actor'); mocks.list.mockResolvedValue({ state: 'available', entries: [] });
  mocks.send.mockResolvedValue({ state: 'confirmed', receipt, receiptStored: true });
  mocks.stage.mockResolvedValue({ state: 'valid' });
  mocks.lock.mockImplementation(async (name, optionsOrRun, run) => typeof optionsOrRun === 'function' ? optionsOrRun() : run({ name }));
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: mocks.lock } });
});
afterEach(() => { mounted.splice(0).forEach(value => value.unmount()); });
describe('studio creation action', () => {
  it('retains confirmed discovery and Open while project commands are paused', async () => {
    mocks.policyReady = false;
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ receipt })] });
    mount(); await flush();
    expect(document.querySelector('a')?.getAttribute('href')).toContain(receipt.estimateId);
    expect(button('Start another revision').disabled).toBe(true);
    await click('Start another revision');
    expect(mocks.ack).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('retains a staged request if current project readiness changes before dispatch', async () => {
    let resolve!: () => void;
    mocks.stage.mockImplementationOnce(async (_scope, staged) => {
      await new Promise<void>(done => { resolve = done; });
      mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ command: staged })] });
      return { state: 'valid' };
    });
    const result = mount(); await flush(); await click('Create new revision');
    mocks.policyReady = false;
    result.rerender(<StudioCreateAction scope={scope} intent={intent} />);
    await act(async () => resolve());
    expect(mocks.send).not.toHaveBeenCalled();
    expect(button('Retry creation').disabled).toBe(true);
    mocks.policyReady = true; result.rerender(<StudioCreateAction scope={scope} intent={intent} />);
    await click('Retry creation');
    expect(mocks.send.mock.calls[0][1]).toEqual(mocks.stage.mock.calls[0][1]);
  });

  it('captures the facade host and shows its retained connection details', async () => {
    const command=makeWebsiteFacadeCommand();
    const {schemaVersion: _version,requestId: _request,...facadeIntent}=command;
    mount(facadeIntent); await flush(); await click('Import as new design');
    expect(mocks.send.mock.calls[0][1]).toMatchObject({...facadeIntent,schemaVersion:'studio_create.v4'});
    const details=document.querySelector('[aria-label="Retained website import details"]')!;
    expect(details.textContent).toContain(command.hostSource.estimateId);
    expect(details.textContent).toContain('Ledger profile150x50');
    expect(details.textContent).toContain('Horizontal position (mm)1000');
    expect(details.textContent).not.toContain('Front beam profile');
  });
  it('uses version three and displays the full retained gable specification', async () => {
    const enrichment = parseStudioWebsiteGableEnrichment({ ...makeStudioWebsiteImportTestFixture().enrichment, family:'gable', pitchDeg:'25', ridgeBeamProfile:'150x50', endFramesMode:'both_ends', tieBeamProfile:'150x50', strutProfile:'100x50', houseEaveGutterMode:'our', outerEaveGutterMode:'our' })!;
    mount({mode:'website',sourceEstimateId:'est-source',expectedRevision:0,expectedUpdatedAt:intent.expectedUpdatedAt,enrichment});
    await flush(); await click('Import as new design');
    expect(mocks.send.mock.calls[0][1]).toMatchObject({schemaVersion:'studio_create.v3',enrichment});
    const retainedDetails = document.querySelector('[aria-label="Retained website import details"]')!;
    expect(retainedDetails.textContent).toContain('Eave underside height');
    expect(retainedDetails.textContent).toContain('Both ends');
    expect(retainedDetails.textContent).toContain('Strut profile100x50');
  });
  it('stages the versioned website command with confirmed physical details before sending', async () => {
    const enrichment = parseStudioWebsiteEnrichment(makeStudioWebsiteImportTestFixture().enrichment)!;
    mount({ mode: 'website', sourceEstimateId: 'est-source', expectedRevision: 0, expectedUpdatedAt: intent.expectedUpdatedAt, enrichment });
    await flush(); await click('Import as new design');
    const sent = mocks.send.mock.calls[0][1];
    expect(sent).toMatchObject({ schemaVersion: 'studio_create.v2', mode: 'website', expectedRevision: 0, enrichment });
    expect(mocks.stage.mock.calls[0][1]).toEqual(sent);
    expect(mocks.stage.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
  });
  it('recovers exact website details instead of replacing them with a changed form', async () => {
    const enrichment = parseStudioWebsiteEnrichment(makeStudioWebsiteImportTestFixture().enrichment)!;
    const original: StudioCreateCommand = { schemaVersion: 'studio_create.v2', requestId: 'website-retained', mode: 'website', sourceEstimateId: 'est-source', expectedRevision: 0, expectedUpdatedAt: intent.expectedUpdatedAt, enrichment };
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ command: original, body: JSON.stringify(original) })] });
    mount({ mode: 'website', sourceEstimateId: 'est-source', expectedRevision: 0, expectedUpdatedAt: intent.expectedUpdatedAt, enrichment: { ...enrichment, heightM: '3.1' } });
    await flush();
    const savedDetails = document.querySelector('[aria-label="Retained website import details"]');
    expect(savedDetails?.textContent).toContain('2.70');
    expect(savedDetails?.textContent).not.toContain('3.1');
    expect(savedDetails?.textContent).toContain('Retrying keeps these details');
    await click('Retry creation');
    expect(mocks.send.mock.calls[0][1]).toEqual(original);
  });
  it('recovery-only discovery never creates a new request when none is retained', async () => {
    mount({ mode: 'recover', sourceEstimateId: 'est-source' }); await flush();
    expect(document.querySelector('button')).toBeNull(); expect(mocks.stage).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('recovery-only mode replays the retained command even when the current source cannot be imported', async () => {
    const original = { ...command, mode: 'import' as const, expectedRevision: 0 as const };
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ command: original, body: JSON.stringify(original) })] });
    mount({ mode: 'recover', sourceEstimateId: 'est-source' }); await flush(); await click('Retry creation');
    expect(mocks.send.mock.calls[0][1]).toEqual(original);
    expect(document.querySelector('a')?.textContent).toBe('Open design');
    expect(document.querySelector('button')).toBeNull();
  });
  it('recovery-only mode opens an existing confirmed destination without allowing another creation', async () => {
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ receipt })] });
    mount({ mode: 'recover', sourceEstimateId: 'est-source' }); await flush();
    expect(document.querySelector('a')?.getAttribute('href')).toContain(receipt.estimateId);
    expect(document.querySelector('button')).toBeNull(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('keeps retained source creation when switching between import and revision intent', async () => {
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained()] });
    mount({ mode: 'import', sourceEstimateId: 'est-source', expectedRevision: 0, expectedUpdatedAt: intent.expectedUpdatedAt }); await flush();
    await click('Retry creation');
    expect(mocks.send.mock.calls[0][1]).toEqual(command);
  });
  it('imports explicitly with revision zero and an optional destination name', async () => {
    mounted.push(renderIntoDocument(<StudioRevisionStart mode="import" actorId="actor" projectId="proj-one" estimateId="est-source" revision={0} updatedAt="2026-09-24T00:00:00Z" duplicateName="Copy of blind estimate" />));
    await flush(); expect(mocks.send).not.toHaveBeenCalled(); await click('Import as new design');
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ mode: 'import', expectedRevision: 0, sourceEstimateId: 'est-source', internalName: 'Copy of blind estimate' });
  });
  it('retains an earlier clone request when a duplicate changes the requested name', async () => {
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained()] });
    mount({ ...intent, internalName: 'Copy of original' }); await flush();
    expect(document.body.textContent).toContain('Retained request: Original source name.');
    await click('Retry creation');
    expect(mocks.send.mock.calls[0][1]).toEqual(command);
  });
  it('normalizes the duplicate name and preserves revision source identity', async () => {
    mounted.push(renderIntoDocument(<StudioRevisionStart actorId="actor" projectId="proj-one" estimateId="est-source" revision={5} updatedAt="2026-09-24T00:00:00Z" duplicateName="  Copy  of original  " />));
    await flush(); await click('Create new revision');
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ ...intent, internalName: 'Copy of original' });
  });
  it('retains the original named request when the current form name changes', async () => {
    const previous: StudioCreateCommand = { schemaVersion: 'studio_create.v1', requestId: 'original', mode: 'blank', scope: 'base', internalName: 'Original option' };
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ command: previous, body: JSON.stringify(previous) })] });
    mount({ mode: 'blank', scope: 'base', internalName: 'Different option' }); await flush();
    expect(document.body.textContent).toContain('Retained request: Original option.');
    expect(mocks.send).not.toHaveBeenCalled();
    await click('Retry creation');
    expect(mocks.send.mock.calls[0][1]).toEqual(previous);
  });
  it('keeps the chosen add-on scope and canonical name in the new design command', async () => {
    mounted.push(renderIntoDocument(<StudioNewDesign projectId="proj-one" initialScope="add_on" initialName="  Courtyard   option  " />));
    await flush(); await click('Create design');
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ mode: 'blank', scope: 'add_on', internalName: 'Courtyard option' });
  });
  it('waits for creation staging, pauses dispatch through sign-out, and resumes exact retry on cancel', async () => {
    let staged!: () => void;
    mocks.stage.mockImplementationOnce(async (_scope, command) => {
      await new Promise<void>(resolve => { staged = resolve; });
      mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ command, body: JSON.stringify(command) })] });
      return { state: 'valid' };
    });
    mount({ mode: 'blank', scope: 'base' }); await flush(); await click('Create design');
    let pending!: ReturnType<typeof prepareStudioSignOut>;
    await act(async () => { pending = prepareStudioSignOut(scope.actorId, () => true); });
    expect(mocks.send).not.toHaveBeenCalled();
    let result!: Awaited<typeof pending>;
    await act(async () => { staged(); result = await pending; });
    expect(result.state).toBe('ready'); expect(mocks.send).not.toHaveBeenCalled();
    expect(button('Retry creation').disabled).toBe(true);
    await act(async () => { if (result.state === 'ready') result.release(); });
    await click('Retry creation');
    expect(mocks.send.mock.calls[0][1]).toEqual(mocks.stage.mock.calls[0][1]);
  });
  it('blocks sign-out after creation staging fails and retains the in-memory request', async () => {
    mocks.stage.mockResolvedValueOnce({ state: 'unavailable' });
    mount(); await flush(); await click('Create new revision');
    let result!: Awaited<ReturnType<typeof prepareStudioSignOut>>;
    await act(async () => { result = await prepareStudioSignOut(scope.actorId, () => true); });
    expect(result.state).toBe('blocked'); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('discovers without sending, then creates and offers the confirmed design link', async () => {
    mount({ mode: 'blank', scope: 'add_on' }); await flush(); expect(mocks.send).not.toHaveBeenCalled();
    await click('Create design');
    expect(mocks.send.mock.calls[0][0]).toEqual(scope);
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ mode: 'blank', scope: 'add_on', schemaVersion: 'studio_create.v1' });
    expect(document.querySelector('a')?.getAttribute('href')).toBe('/staff/design-studio/proj-one/est-created/edit');
    expect(button('Create another design')).toBeTruthy();
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['estimates', 'local', 'metaByProject', scope.projectId] });
  });
  it('matches clone source despite changed CAS values and retries only the original command', async () => {
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained()] });
    mount(); await flush(); expect(mocks.send).not.toHaveBeenCalled();
    await click('Retry creation'); expect(mocks.send.mock.calls[0][1]).toEqual(command);
  });
  it('shows a retained confirmed result without sending or clearing it', async () => {
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ receipt })] });
    mount(); await flush(); expect(document.querySelector('a')?.textContent).toBe('Open design'); expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each(['corrupt', 'unsupported', 'rejected', 'multiple'])('blocks creation while preserving %s evidence', async kind => {
    const entries = kind === 'multiple' ? [retained(), retained()] : kind === 'rejected' ? [retained({ rejectedStatus: 409 })] : [{ recovery: { state: kind, message: 'kept' } }];
    mocks.list.mockResolvedValue({ state: 'available', entries }); mount(); await flush();
    expect(document.querySelector('[role="alert"]')).not.toBeNull(); expect(document.querySelector('button')).toBeNull(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('shows uncertain results as an explicit exact retry, including missing local confirmation', async () => {
    mocks.send.mockImplementationOnce(async (_scope, sent) => { mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ command: sent })] }); return { state: 'unconfirmed', message: 'Not confirmed' }; });
    mount(); await flush(); await click('Create new revision'); const sent = mocks.send.mock.calls[0][1];
    expect(button('Retry creation')).toBeTruthy(); await click('Retry creation'); expect(mocks.send.mock.calls[1][1]).toEqual(sent);
  });
  it('rechecks inside the lock without automatically replaying a request from another tab', async () => {
    mount(); await flush(); mocks.list.mockResolvedValue({ state: 'available', entries: [retained()] });
    await click('Create new revision'); expect(mocks.send).not.toHaveBeenCalled(); expect(button('Retry creation')).toBeTruthy();
  });
  it('does not create a replacement when an expected retained request disappears', async () => {
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained()] }); mount(); await flush();
    mocks.list.mockResolvedValue({ state: 'available', entries: [] }); await click('Retry creation');
    expect(mocks.send).not.toHaveBeenCalled(); expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('prevents double clicks while creation is in flight', async () => {
    let resolve!: (value: unknown) => void; mocks.send.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    mount(); await flush(); await click('Create new revision'); expect(button('Creating…').disabled).toBe(true);
    await click('Creating…'); expect(mocks.send).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ state: 'confirmed', receipt, receiptStored: false })); expect(document.querySelector('a')?.textContent).toBe('Open design');
  });
  it('withholds responses after owner change or unmount', async () => {
    let resolve!: (value: unknown) => void; mocks.send.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const rendered = mount(); await flush(); await click('Create new revision'); mocks.owner.mockReturnValue('another');
    rendered.rerender(<StudioCreateAction scope={scope} intent={intent} />);
    await act(async () => resolve({ state: 'confirmed', receipt, receiptStored: true })); expect(document.querySelector('a')).toBeNull();
  });
  it('fails closed when safe browser request coordination is unavailable', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); mount(); await flush();
    expect(mocks.send).not.toHaveBeenCalled(); expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('offers accessible base/add-on selection and submits the selected scope', async () => {
    const rendered = renderIntoDocument(<StudioNewDesign projectId={scope.projectId} />); mounted.push(rendered); await flush();
    const choices = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(choices).toHaveLength(2); expect(choices[0].checked).toBe(true);
    await act(async () => choices[1].click()); await click('Create design');
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ mode: 'blank', scope: 'add_on' });
  });
  it('does not confuse a retained blank base request with an add-on intent', async () => {
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ command: { schemaVersion: 'studio_create.v1', requestId: 'base-id', mode: 'blank', scope: 'base' } })] });
    mount({ mode: 'blank', scope: 'add_on' }); await flush(); await click('Create design');
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ mode: 'blank', scope: 'add_on' });
  });
  it('clears only the confirmed exact request after a deliberate start-another action', async () => {
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ receipt })] });
    mocks.ack.mockImplementation(async () => { mocks.list.mockResolvedValue({ state: 'available', entries: [] }); return true; });
    mount(); await flush(); expect(mocks.ack).not.toHaveBeenCalled();
    await click('Start another revision');
    expect(mocks.ack).toHaveBeenCalledWith(scope, command, { body: JSON.stringify(command), receipt });
    expect(button('Create new revision')).toBeTruthy(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('keeps the receipt and Open design link when conditional acknowledgement fails', async () => {
    mocks.list.mockResolvedValue({ state: 'available', entries: [retained({ receipt })] }); mocks.ack.mockResolvedValue(false);
    mount(); await flush(); await click('Start another revision');
    expect(document.querySelector('a')?.textContent).toBe('Open design');
    expect(document.body.textContent).toContain('could not be cleared safely'); expect(mocks.send).not.toHaveBeenCalled();
  });
});

// This isolated presenter fixture supplies the native entry link's existing Portal toast surface.
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({error:vi.fn()})}));

describe('explicit create-and-open revision',()=>{
 function direct(){const value=renderIntoDocument(<StudioCreateAction scope={scope} intent={intent} openOnCreated/>);mounted.push(value);return value;}
 it('creates only on click and opens the exact freshly checked editable target without clearing its receipt',async()=>{
  mocks.api.mockResolvedValue({authoring:{estimate:{id:receipt.estimateId,projectId:scope.projectId,requiresNewRevision:false},nextAction:'edit'}});direct();await flush();expect(mocks.send).not.toHaveBeenCalled();expect(mocks.navigate).not.toHaveBeenCalled();await click('Edit a new revision');expect(mocks.send).toHaveBeenCalledOnce();expect(mocks.navigate).toHaveBeenCalledWith(`/staff/design-studio/${scope.projectId}/${receipt.estimateId}/edit`);expect(mocks.ack).not.toHaveBeenCalled();expect(document.body.textContent).not.toContain('Start another revision');
 });
 it('keeps a discovered confirmed target as an explicit useful Review link, never auto-opening or auto-creating',async()=>{
  mocks.list.mockResolvedValue({state:'available',entries:[retained({receipt})]});direct();await flush();expect(mocks.send).not.toHaveBeenCalled();expect(mocks.api).not.toHaveBeenCalled();expect(mocks.navigate).not.toHaveBeenCalled();expect(document.querySelector('a')?.getAttribute('href')).toBe(`/staff/design-studio/${scope.projectId}/${receipt.estimateId}`);expect(mocks.ack).not.toHaveBeenCalled();
 });
 it('opens Review when the exact confirmed destination has since become quoted, without creating another revision',async()=>{
  mocks.api.mockResolvedValue({authoring:{estimate:{id:receipt.estimateId,projectId:scope.projectId,requiresNewRevision:true},nextAction:'create-revision'}});direct();await flush();await click('Edit a new revision');expect(mocks.push).toHaveBeenCalledWith(`/staff/design-studio/${scope.projectId}/${receipt.estimateId}`);expect(mocks.navigate).not.toHaveBeenCalled();expect(mocks.send).toHaveBeenCalledOnce();expect(mocks.ack).not.toHaveBeenCalled();
 });
 it('does not navigate after a held target verification crosses an identity lifetime',async()=>{
  let finish!:(value:unknown)=>void;mocks.api.mockImplementation(()=>new Promise(r=>{finish=r;}));direct();await flush();await click('Edit a new revision');await act(async()=>invalidateStudioLifecycle());await act(async()=>finish({authoring:{estimate:{id:receipt.estimateId,projectId:scope.projectId,requiresNewRevision:false},nextAction:'edit'}}));expect(mocks.navigate).not.toHaveBeenCalled();expect(mocks.push).not.toHaveBeenCalled();expect(mocks.ack).not.toHaveBeenCalled();
 });
});

it('keeps the created receipt and a usable Review link when guarded native opening fails',async()=>{
 mocks.api.mockResolvedValue({authoring:{estimate:{id:receipt.estimateId,projectId:scope.projectId,requiresNewRevision:false},nextAction:'edit'}});mocks.navigate.mockRejectedValue(Error('Local persistence unavailable'));const m=renderIntoDocument(<StudioCreateAction scope={scope} intent={intent} openOnCreated/>);mounted.push(m);await flush();await click('Edit a new revision');expect(m.container.textContent).toContain('created and kept');expect(m.container.querySelector('a')?.getAttribute('href')).toBe(`/staff/design-studio/${scope.projectId}/${receipt.estimateId}`);expect(mocks.ack).not.toHaveBeenCalled();expect(mocks.send).toHaveBeenCalledOnce();
});
