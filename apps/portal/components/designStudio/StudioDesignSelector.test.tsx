import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import StudioDesignSelector from './StudioDesignSelector';
import StudioDesignHeading from './StudioDesignHeading';
import { readStudioProjectChoice, type StudioProjectDesigns } from '@/lib/designStudio/projectDesigns';
const mocks = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), rename: vi.fn() }));
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: mocks.api }));
vi.mock('@/lib/designStudio/studioDocumentNavigation', () => ({ navigateStudioDocument: mocks.navigate }));
vi.mock('@/lib/designStudio/renameDesign',()=>({renameStudioDesign:mocks.rename}));
const projectId = 'proj_10000000-0000-4000-8000-000000000001';
const inventory: StudioProjectDesigns & { projectId: string } = { projectId, project: { id: projectId.slice(5), name: 'Synthetic courtyard' }, loadError: false, designs: Array.from({ length: 20 }, (_, index) => ({ id: `est-${index}`, label: `Courtyard ${index + 1}`, versionLabel: `V${20 - index}`, createdAt: '2026-11-02T00:00:00Z', history: index === 1 ? 'Used by a quote' : index === 2 ? 'Archived design' : 'Saved draft', quoteLabel: index === 1 ? 'Q-SYNTHETIC · quote revision 2' : null, canOpenEditor: index !== 1 && index !== 2, status: index === 2 ? 'archived' : 'draft', commercialScopeId: index === 3 ? 'scope-addon' : null, isActiveDraft: index === 0 })) };
let mounted: ReturnType<typeof renderIntoDocument>;
const context = (actor = 'actor') => ({ status: 'authenticated', user: { id: actor }, role: 'staff' }) as any;
async function mount(actor = 'actor', estimateId = 'est-0') { await act(async () => { mounted = renderIntoDocument(<PortalAuthContext.Provider value={context(actor)}><StudioDesignSelector projectId={projectId} estimateId={estimateId}><h1>Courtyard</h1></StudioDesignSelector></PortalAuthContext.Provider>); }); }
async function open() { await act(async () => mounted.container.querySelector('button')!.click()); }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.api.mockResolvedValue(inventory); mocks.navigate.mockResolvedValue(undefined); });
afterEach(() => mounted?.unmount());
it('keeps a compact trigger across the header and reveals current, quoted, archived and add-on history with exact destinations', async () => {
  await mount(); expect(mounted.container.querySelector('ul')).toBeNull(); expect(readStudioProjectChoice('actor', projectId)).toBe('est-0');
  await open(); const links = [...mounted.container.querySelectorAll('a')]; expect(links).toHaveLength(20);
  expect(links[0].getAttribute('aria-current')).toBe('page'); expect(links[0].getAttribute('href')).toBe(`/staff/design-studio/${projectId}/est-0/edit`);
  expect(links[1].getAttribute('href')).toBe(`/staff/design-studio/${projectId}/est-1`); expect(links[1].textContent).toContain('Q-SYNTHETIC'); expect(links[1].textContent).toContain('Review');
  expect(links[2].textContent).toContain('Archived'); expect(links[3].textContent).toContain('Add-on');
  expect(mounted.container.textContent).toContain('New option'); expect(mounted.container.textContent).toContain('New add-on');
  expect(mocks.api).toHaveBeenCalledTimes(2); // one admission summary, one deliberate fresh opening
  expect(mocks.api.mock.calls.every(([,options])=>options.cache==='no-store')).toBe(true);
});
it('uses the existing awaited navigation drain, retains current choice on refusal, and permits retry', async () => {
  await mount(); await open(); mocks.navigate.mockRejectedValueOnce(Error('Unsaved work is kept. Finish the current change.'));
  await act(async () => mounted.container.querySelectorAll('a')[1].click());
  expect(mocks.navigate).toHaveBeenCalledWith(`/staff/design-studio/${projectId}/est-1`, false, undefined, expect.any(AbortSignal));
  expect(mounted.container.textContent).toContain('Unsaved work is kept'); expect(readStudioProjectChoice('actor', projectId)).toBe('est-0');
  await act(async () => mounted.container.querySelectorAll('a')[1].click()); expect(mocks.navigate).toHaveBeenCalledTimes(2);
});
it.each(['New option', 'New add-on'])('drains accepted work before the explicit %s route', async label => {
  await mount(); await open(); const button = [...mounted.container.querySelectorAll('button')].find(node => node.textContent === label)!;
  await act(async () => button.click()); const url=new URL(mocks.navigate.mock.calls[0][0],'http://localhost');expect(url.pathname).toBe(`/staff/projects/${projectId}/studio`);expect(url.searchParams.get('new')).toBe(label==='New option'?'option':'add-on');expect(url.searchParams.get('requestId')).toMatch(/^[a-f0-9-]{36}$/);
});
it('refuses blank creation on selector failure and restores history through its own retry', async () => {
  await mount(); mocks.api.mockRejectedValueOnce(Error('offline')); await open();
  expect(mounted.container.textContent).toContain('Design history could not be loaded'); expect(mounted.container.textContent).not.toContain('New option');
  await act(async () => [...mounted.container.querySelectorAll('button')].find(button => button.textContent === 'Retry history')!.click()); expect(mounted.container.querySelectorAll('a')).toHaveLength(20);
});
it('restores focus on Escape and dismisses outside without changing the header title', async () => {
  await mount(); const trigger = mounted.container.querySelector('button')!; await open();
  await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))); expect(mounted.container.querySelector('section')).toBeNull(); expect(document.activeElement).toBe(trigger);
  await open(); await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))); expect(mounted.container.querySelector('section')).toBeNull(); expect(mounted.container.querySelector('h1')?.textContent).toBe('Courtyard');
});
it('retires a held actor read, rejects wrong-project inventory and never stores another actor selection', async () => {
  let finish!: (value: unknown) => void; mocks.api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await mount(); const signal = mocks.api.mock.calls[0][1].signal;
  await act(async () => mounted.root.render(<PortalAuthContext.Provider value={context('actor-b')}><StudioDesignSelector projectId={projectId} estimateId="est-1"><h1>Other session</h1></StudioDesignSelector></PortalAuthContext.Provider>));
  expect(signal.aborted).toBe(true); await act(async () => finish(inventory)); expect(readStudioProjectChoice('actor', projectId)).toBeNull(); expect(readStudioProjectChoice('actor-b', projectId)).toBe('est-1');
  mocks.api.mockResolvedValueOnce({ ...inventory, projectId: 'wrong-project' }); await open(); expect(mounted.container.querySelectorAll('a')).toHaveLength(0); expect(mounted.container.textContent).toContain('could not be loaded');
});

it('edits the current title inside Studio, preserves typed input on failure and updates confirmed heading/history without touching quoted content',async()=>{
 const named={...inventory,designs:inventory.designs.map(row=>({...row,designId:'synthetic-design'}))};mocks.api.mockResolvedValue(named);
 const identity={projectName:'Synthetic courtyard',internalName:'Courtyard 1',createdAt:null,history:'working' as const,quoteLabel:null};
 await act(async()=>{mounted=renderIntoDocument(<PortalAuthContext.Provider value={context()}><StudioDesignSelector projectId={projectId} estimateId="est-0" renameAvailable><StudioDesignHeading identity={identity} versionLabel="V20"/></StudioDesignSelector></PortalAuthContext.Provider>);});
 await act(async()=>mounted.container.querySelector('h1 button')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 const dialog=document.querySelector('[role=dialog]')!,input=dialog.querySelector('input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Front courtyard');input.dispatchEvent(new Event('input',{bubbles:true}));});
 mocks.rename.mockRejectedValueOnce(Error('Connection unavailable. Your name is kept.'));
 await act(async()=>dialog.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect((dialog.querySelector('input') as HTMLInputElement).value).toBe('Front courtyard');expect(dialog.textContent).toContain('Your name is kept');
  mocks.rename.mockImplementationOnce(async(_scope,_name,_signal,confirmed)=>{confirmed('Front courtyard');return {message:'Opening saved design',reopen:vi.fn(),leave:vi.fn(),retire:vi.fn()};});
 await act(async()=>dialog.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(mounted.container.querySelector('h1')?.textContent).toContain('Front courtyard');expect(mocks.rename.mock.calls[1].slice(0,2)).toEqual([{actorId:'actor',projectId,estimateId:'est-0',designId:'synthetic-design'},'Front courtyard']);
});
it('keeps naming disabled beside a dirty design and explains Save before rename in its selector',async()=>{
 mocks.api.mockResolvedValue({...inventory,designs:inventory.designs.map(row=>({...row,designId:'synthetic-design'}))});
 await act(async()=>{mounted=renderIntoDocument(<PortalAuthContext.Provider value={context()}><StudioDesignSelector projectId={projectId} estimateId="est-0"><StudioDesignHeading versionLabel="V20"/></StudioDesignSelector></PortalAuthContext.Provider>);});
 expect(mounted.container.querySelector<HTMLButtonElement>('h1 button')!.disabled).toBe(true);
 await act(async()=>[...mounted.container.querySelectorAll('button')].find(button=>button.textContent?.includes('Designs'))!.click());expect(mounted.container.textContent).toContain('Save the current design before renaming');expect(mocks.rename).not.toHaveBeenCalled();
});
it('keeps uncertain rename recovery through dialog dismissal and inventory refresh, then retires it with the actual actor/document lifetime',async()=>{
 mocks.api.mockResolvedValue({...inventory,designs:inventory.designs.map(row=>({...row,designId:'synthetic-design'}))});const recovery={message:'The name may already be saved. Reopen the saved design.',reopen:vi.fn().mockResolvedValue(undefined),leave:vi.fn(),retire:vi.fn()};mocks.rename.mockResolvedValue(recovery);
 await act(async()=>{mounted=renderIntoDocument(<PortalAuthContext.Provider value={context()}><StudioDesignSelector projectId={projectId} estimateId="est-0" renameAvailable><StudioDesignHeading versionLabel="V20"/></StudioDesignSelector></PortalAuthContext.Provider>);});
 await act(async()=>mounted.container.querySelector('h1 button')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));const dialog=document.querySelector('[role=dialog]')!;
 await act(async()=>dialog.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));const renameSignal=mocks.rename.mock.calls[0][2];
 await act(async()=>[...dialog.querySelectorAll('button')].find(button=>button.textContent==='Cancel')!.click());expect(mounted.container.textContent).toContain('The name may already be saved');expect(recovery.retire).not.toHaveBeenCalled();
 await act(async()=>[...mounted.container.querySelectorAll('button')].find(button=>button.textContent?.includes('Designs'))!.click());expect(renameSignal.aborted).toBe(false);expect(recovery.retire).not.toHaveBeenCalled();
 await act(async()=>[...mounted.container.querySelectorAll('button')].find(button=>button.textContent==='Reopen saved design')!.click());expect(recovery.reopen).toHaveBeenCalledOnce();expect(mocks.rename).toHaveBeenCalledOnce();
 await act(async()=>mounted.root.render(<PortalAuthContext.Provider value={context('actor-b')}><StudioDesignSelector projectId={projectId} estimateId="est-1"><h1>Other session</h1></StudioDesignSelector></PortalAuthContext.Provider>));expect(renameSignal.aborted).toBe(true);expect(recovery.retire).toHaveBeenCalledOnce();
});
