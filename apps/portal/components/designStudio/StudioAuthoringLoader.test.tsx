import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import StudioAuthoringLoader,{StudioAuthoringContent} from './StudioAuthoringLoader';
import {StudioDocumentContext} from './StudioDocumentContext';
import StudioDesignHeading from './StudioDesignHeading';

const mocks = vi.hoisted(() => ({ api: vi.fn(), opening:vi.fn(),role:'staff', leaf: vi.fn(), actorId: 'actor' as string | undefined }));
vi.mock('next/link',()=>({default:({prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=><a data-prefetch={String(prefetch)} {...props}/>}));
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: mocks.api }));
vi.mock('@/lib/designStudio/studioOpeningTransport',()=>({readStudioOpening:mocks.opening}));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ user: mocks.actorId ? { id: mocks.actorId } : null, role: mocks.role }) }));
vi.mock('./studioLeafLoading', () => ({ loadStudioEditor: mocks.leaf }));
vi.mock('./StudioRevisionStart', () => ({ default: (props: Record<string, unknown>) => <div data-testid="revision">{JSON.stringify(props)}</div> }));
vi.mock('./StudioCreateAction', () => ({ default: (props: Record<string, unknown>) => <div data-testid="recovery">{JSON.stringify(props)}</div> }));
const source = () => ({ state: 'ready', estimate: { id: 'est_source', projectId: 'proj_one', versionLabel: 'V1', updatedAt: '2026-09-24T00:00:00Z', requiresNewRevision: false }, view: { designId: 'design', revision: 4 }, nextAction: 'edit', reason: null });
const mounted: ReturnType<typeof renderIntoDocument>[] = [];
const Editor = (props: { scope: { estimateId: string; actorId: string } }) => <div data-testid="editor">{props.scope.actorId}:{props.scope.estimateId}</div>;
beforeEach(() => { vi.resetAllMocks(); mocks.actorId = 'actor'; mocks.role='staff';mocks.opening.mockImplementation((path:string,_scope:unknown,signal:AbortSignal)=>mocks.api(path,{signal})); mocks.api.mockResolvedValue({ authoring: source() }); mocks.leaf.mockResolvedValue(Editor); });
afterEach(() => mounted.splice(0).forEach(value => value.unmount()));
async function mount(intent?: 'edit' | 'revision' | 'duplicate') {
  const rendered = renderIntoDocument(<StudioAuthoringLoader projectId="proj_one" estimateId="est_source" intent={intent} duplicateName="Copy of courtyard" />);
  mounted.push(rendered); await act(async () => {}); return rendered.container;
}
describe('Studio authoring intent', () => {
  it.each(['website-import','import'])('keeps legacy %s responses review-only without an import or editor', async nextAction => {
    mocks.api.mockResolvedValue({authoring:{...source(),state:'needs-import',view:null,nextAction,reason:'Open the established calculator.'}});
    const container=await mount();
    expect(container.textContent).toContain('Open the established calculator.');
    expect(container.querySelector('[data-testid="revision"]')).toBeNull();
    expect(container.querySelector('[data-testid="editor"]')).toBeNull();
  });
  it('opens the editor only for the normal editable source intent', async () => {
    const container = await mount(); expect(container.querySelector('[data-testid="editor"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="revision"]')).toBeNull();
  });
  it.each(['revision', 'duplicate'] as const)('requires explicit creation for %s, without forwarding navigation query into source reads', async intent => {
    const container = await mount(intent);
    expect(container.querySelector('[data-testid="editor"]')).toBeNull();
    const props = JSON.parse(container.querySelector('[data-testid="revision"]')!.textContent!);
    expect(props).toMatchObject({ estimateId: 'est_source', revision: 4, updatedAt: source().estimate.updatedAt });
    if (intent === 'duplicate') expect(props.duplicateName).toBe('Copy of courtyard');
    else expect(props).not.toHaveProperty('duplicateName');
    expect(mocks.api.mock.calls[0][0]).toBe('/api/projects/proj_one/estimates/est_source/studio');
  });
  it('does not invent an editable design for an unsupported historical source', async () => {
    mocks.api.mockResolvedValue({ authoring: { ...source(), state: 'needs-import', view: null, nextAction: 'import-required', reason: 'Supported import required.' } });
    const container = await mount('duplicate');
    expect(container.textContent).toContain('Supported import required.');
    expect(container.querySelector('[data-testid="revision"]')).toBeNull();
    expect(container.querySelector('[data-testid="editor"]')).toBeNull();
    expect(JSON.parse(container.querySelector('[data-testid="recovery"]')!.textContent!).intent).toEqual({ mode: 'recover', sourceEstimateId: 'est_source' });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
describe('Studio editor loading boundary', () => {
  it('passes exact display identity only after the current actor and source read, without changing its scope',async()=>{
    const identity={internalName:'Courtyard alternative',projectName:'Garden project',createdAt:'2026-10-21T01:00:00Z',history:'working' as const,quoteLabel:null};
    const leaf=vi.fn((props:any)=><StudioDesignHeading identity={props.identity} versionLabel={props.versionLabel}/>);
    mocks.leaf.mockResolvedValue(leaf);mocks.api.mockResolvedValue({authoring:{...source(),identity}});
    const container=await mount();expect(container.textContent).toContain('Courtyard alternative');expect(container.textContent).toContain('Garden project');
    expect(leaf.mock.calls[0][0].scope).toEqual({actorId:'actor',projectId:'proj_one',estimateId:'est_source',designId:'design'});
    mocks.actorId='other';const pending=deferred<any>();mocks.api.mockReturnValue(pending.promise);
    await act(async()=>mounted[0].rerender(<StudioAuthoringLoader projectId="proj_other" estimateId="est_other"/>));
    expect(container.textContent).not.toContain('Courtyard alternative');expect(container.textContent).not.toContain('Garden project');
    await act(async()=>pending.resolve({authoring:{...source(),identity}}));expect(container.querySelector('h1')?.textContent).not.toBe('Courtyard alternative');
  });
  it('starts the leaf with the data request and retains loading until both are ready', async () => {
    const data = deferred<{ authoring: ReturnType<typeof source> }>(), leaf = deferred<typeof Editor>();
    mocks.api.mockReturnValue(data.promise); mocks.leaf.mockReturnValue(leaf.promise);
    const container = await mount();
    expect(mocks.api).toHaveBeenCalledTimes(1); expect(mocks.leaf).toHaveBeenCalledTimes(1);
    await act(async () => data.resolve({ authoring: source() }));
    expect(container.textContent).toContain('Opening saved design');
    expect(container.querySelector('[data-testid="editor"]')).toBeNull();
    await act(async () => leaf.resolve(Editor));
    expect(container.querySelector('[data-testid="editor"]')?.textContent).toBe('actor:est_source');
  });
  it('retries a failed module without offering to recover or replace the saved design', async () => {
    mocks.leaf.mockResolvedValueOnce(null);
    const container = await mount();
    expect(container.textContent).toContain('The design editor could not be opened');
    expect(container.querySelector('[data-testid="recovery"]')).toBeNull();
    await act(async () => (container.querySelector('button') as HTMLButtonElement).click());
    expect(mocks.leaf).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="editor"]')).not.toBeNull();
  });
  it('does not preload editing code before auth or for revision/duplicate creation', async () => {
    mocks.actorId = undefined;
    await mount(); expect(mocks.api).not.toHaveBeenCalled(); expect(mocks.leaf).not.toHaveBeenCalled();
    mocks.actorId = 'actor';
    await mount('revision'); await mount('duplicate');
    expect(mocks.leaf).not.toHaveBeenCalled();
  });
  it('discards an old actor/source completion while the leaf is pending', async () => {
    const leaf = deferred<typeof Editor>();
    mocks.leaf.mockReturnValueOnce(leaf.promise);
    await mount();
    const oldSignal = mocks.api.mock.calls[0][1].signal as AbortSignal;
    mocks.actorId = 'other';
    mocks.api.mockResolvedValue({ authoring: { ...source(), estimate: { ...source().estimate, id: 'est_other' } } });
    await act(async () => mounted[0].rerender(<StudioAuthoringLoader projectId="proj_one" estimateId="est_other" />));
    expect(oldSignal.aborted).toBe(true);
    expect(mounted[0].container.querySelector('[data-testid="editor"]')?.textContent).toBe('other:est_other');
    await act(async () => leaf.resolve(Editor));
    expect(mounted[0].container.querySelector('[data-testid="editor"]')?.textContent).toBe('other:est_other');
  });
  it('does not wait on unused editor code for an unsupported source', async () => {
    mocks.leaf.mockReturnValue(new Promise(() => {}));
    mocks.api.mockResolvedValue({ authoring: { ...source(), state: 'needs-import', view: null, reason: 'Use the specialist calculator.' } });
    expect((await mount()).textContent).toContain('Use the specialist calculator');
  });
  it('aborts the source request on unmount while the leaf loads', async () => {
    const leaf = deferred<typeof Editor>(); mocks.leaf.mockReturnValue(leaf.promise);
    await mount(); const signal = mocks.api.mock.calls[0][1].signal as AbortSignal;
    mounted.pop()!.unmount(); expect(signal.aborted).toBe(true);
    await act(async () => leaf.resolve(Editor));
  });
});

 it('binds initial opening to current role/scope and cancels that lifetime on role changes',async()=>{
  const tail={binding:{role:'staff'},result:new Promise(()=>{})},leaf=vi.fn((_props:any)=> <div data-testid="editor"/>);mocks.leaf.mockResolvedValue(leaf);mocks.api.mockResolvedValue({authoring:source(),openingPrice:tail});
  await mount();expect(mocks.opening.mock.calls[0][1]).toEqual({actorId:'actor',role:'staff',projectId:'proj_one',estimateId:'est_source'});expect(leaf.mock.calls[0][0].openingPrice).toBe(tail);
  const oldSignal=mocks.opening.mock.calls[0][2];mocks.role='admin';mocks.api.mockResolvedValue({authoring:source(),openingPrice:{...tail,binding:{role:'admin'}}});
  await act(async()=>mounted[0].rerender(<StudioAuthoringLoader projectId="proj_one" estimateId="est_source"/>));
  expect(oldSignal.aborted).toBe(true);expect(mocks.opening.mock.calls[1][1].role).toBe('admin');expect(leaf.mock.calls.at(-1)![0].openingPrice.binding.role).toBe('admin');
 });

it('does not prefetch public loading or recovery Review from a document boundary, before actor admission',()=>{
 const value={callback:'/staff/design-studio/proj_one/est_source/edit',admission:null,visible:false,error:null,leaving:false,frame:{current:null},retry:vi.fn()};
 const content=(loaded:null|{authoring:null})=><StudioAuthoringContent projectId="proj_one" estimateId="est_source" loaded={loaded} retry={()=>{}}/>;
 const rendered=renderIntoDocument(<StudioDocumentContext.Provider value={value}>{content(null)}</StudioDocumentContext.Provider>);mounted.push(rendered);
 expect(rendered.container.querySelector('a')?.dataset.prefetch).toBe('false');
 rendered.rerender(<StudioDocumentContext.Provider value={value}>{content({authoring:null})}</StudioDocumentContext.Provider>);
 expect(rendered.container.querySelector('a')?.dataset.prefetch).toBe('false');
 rendered.rerender(content(null));expect(rendered.container.querySelector('a')?.dataset.prefetch).toBe('undefined');
});
