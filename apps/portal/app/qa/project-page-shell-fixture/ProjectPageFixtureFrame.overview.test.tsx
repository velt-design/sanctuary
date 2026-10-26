import {act} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../../test/reactHarness';
import Frame from './ProjectPageFixtureFrame';
import {projectStory} from '../project-command-centre-fixture/projectStories';
import {visitsFixture} from '../portal-progressive-fixture/data';
import {schedule} from './commercialClarityData';
import {__resetLocalFirstStoreForTests,__setLocalFirstStorageAdapterForTests,bindLocalFirstStoreOwner} from '@/lib/localFirst/store';
const state=vi.hoisted(()=>({phase:'pending',api:vi.fn()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams({overview:'1',snapshotState:state.phase,tab:'activity'}),usePathname:()=>'/qa/project-page-shell-fixture',useRouter:()=>({push:vi.fn(),replace:vi.fn()})}));
vi.mock('@/lib/repo/apiClient',async(original)=>({...await original<typeof import('@/lib/repo/apiClient')>(),apiJson:state.api}));
// Unrelated header and note editors are stubbed; the real Overview and its read owners are composed.
vi.mock('@/components/projects/ProjectPage/ProjectHeaderSurface',()=>({default:()=> <h1>Fictional project</h1>}));
vi.mock('@/components/projects/ProjectPage/tabs/_components/ProjectNotesPanel.client',()=>({default:()=> <p>Fictional notes</p>}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({success:vi.fn(),error:vi.fn()})}));
const snapshot={workModel:'v2',project:{id:'proj_fixture_shell',name:'Fictional project',stage:'deposit',contactName:'Sample customer',contactEmail:'sample@example.invalid',siteAddress:'Synthetic site',hasJobPacks:true},pipeline:{stage:'deposit'},notes:[],emails:[],activity:[]} as const;
let view:ReturnType<typeof renderIntoDocument>|undefined,client:QueryClient;
afterEach(()=>{view?.unmount();client?.clear();__resetLocalFirstStoreForTests();__setLocalFirstStorageAdapterForTests(null);state.api.mockReset();state.phase='pending';});
it('keeps genuine public Overview owners while pending has no private producer, then adopts and retires the same source',async()=>{
 __resetLocalFirstStoreForTests();__setLocalFirstStorageAdapterForTests({get:async()=>undefined,set:async()=>undefined});bindLocalFirstStoreOwner('fictional-fixture-staff');
 const story=projectStory('installation');state.api.mockImplementation(async(path:string)=>path.includes('command-centre')?{projectId:snapshot.project.id,workModel:'v2',projectWork:story.work.projectWork,currentDesign:story.currentDesign,owner:{},generatedAt:new Date().toISOString()}:path.includes('invoice-schedule')?{schedule}:path.includes('outlook-site-visits')?visitsFixture():{state:'not_connected'});
 client=new QueryClient({defaultOptions:{queries:{retry:false}}});const tree=()=> <QueryClientProvider client={client}><Frame snapshot={snapshot as any} host="fixture" tab="activity"/></QueryClientProvider>;
 view=renderIntoDocument(tree());const labels=['Project Work','Project orientation','Payment position','Site visits','Customer conversations'];
 const owners=labels.map(label=>view!.container.querySelector(`[aria-label="${label}"]`));expect(owners.every(Boolean)).toBe(true);expect(state.api).not.toHaveBeenCalled();
 const frame=view.container.querySelector('[data-project-page-frame]');
 state.phase='summary';view.rerender(tree());await vi.waitFor(async()=>{await act(async()=>{await vi.dynamicImportSettled();});expect(view!.container.textContent).toContain('Confirm the installation week with Aroha');});
 expect(state.api.mock.calls.some(([path])=>path.includes('command-centre'))).toBe(true);
 for(const phase of ['fresh','refresh-failed','pending']){state.phase=phase;view.rerender(tree());await act(async()=>{});labels.forEach((label,index)=>expect(view!.container.querySelector(`[aria-label="${label}"]`)).toBe(owners[index]));expect(view.container.querySelector('[data-project-page-frame]')).toBe(frame);}
 expect(view.container.textContent).not.toContain('Confirm the installation week with Aroha');expect(view.container.textContent).not.toContain('Recorded payments$');
});
