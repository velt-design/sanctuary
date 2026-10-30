import {ToastProvider} from '@/components/ui/toast/ToastProvider';
import {act,useMemo} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../../test/reactHarness';
import OverviewTab from './tabs/OverviewTab';
import ProjectOverviewSurface,{useOverviewControls,type ProjectOverviewEvidence} from './tabs/ProjectOverviewSurface';
import {ProjectOverviewReadsProvider} from './ProjectOverviewReadContext';
import {ProjectCommercialProvider,useProjectCommercialContext} from './ProjectCommercialContext';
import {ProjectCorrespondenceWarmRead} from './tabs/overview/ProjectCorrespondenceWarmRead';
import {ProjectEmailReadingProvider,useProjectEmailReadingState} from './tabs/overview/ProjectEmailReadingState';
import {useOwnedPortalPublication} from '@/components/page-state/PortalPageSource';
import {correspondenceFixture} from '@/app/qa/project-command-centre-fixture/correspondenceFixture';
import {schedule} from '@/app/qa/project-page-shell-fixture/commercialClarityData';

const mocks=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('@/lib/repo/apiClient',async(original)=>({...await original<typeof import('@/lib/repo/apiClient')>(),apiJson:mocks.api}));
// These unrelated work/visit/editor owners are not part of the transferred context regression.
// CurrentDesignCommercialCard, PaymentPositionQuery/Position and all correspondence/reader components remain REAL.
vi.mock('./tabs/overview/ProjectWorkSection',()=>({default:()=> <section data-project-work-section="true">Current work</section>}));
vi.mock('./tabs/overview/ProjectOrientationBand',()=>({default:()=> <p>Current orientation</p>}));
vi.mock('@/components/site-visits/ProjectNextVisit',()=>({default:()=>null}));
vi.mock('./tabs/_components/ProjectNotesPanel.client',()=>({default:()=> <p>Current notes</p>}));

const projectId='proj_context_fixture';
const work={projectId,modelVersion:2,effectiveState:'CLOSED',operationalState:'CLOSED',closedOutcome:'CANCELLED',stateRowVersion:1,generatedAt:'2026-09-16T01:00:00Z',openItems:[],blockedItems:[],confirmedFacts:[]};
const currentDesign={source:'estimate',statusLabel:'Estimate current',statusTone:'neutral',designState:'available',design:{size:'6m x 4m',shape:'Gable',roofing:'Acrylic',additionalModuleCount:0},price:{source:'estimate',totalIncGstCents:123456},estimate:{id:'est_context',versionLabel:'V1',savedAt:'2026-09-16T01:00:00Z',isActiveDraft:true,isLocked:false,isQuoteSource:false,costingState:'current'},quote:null,newerEstimate:null,latestDeclinedQuote:null,warnings:[],links:{designs:'?tab=estimates',quotes:'?tab=quotes',estimate:'?tab=estimates&estimateId=est_context',quote:null}};
const snapshot={project:{id:projectId,name:'Fictional context project',stage:'new',contactEmail:'customer@example.test'},workModel:'v2',projectWork:work,pipeline:{stage:'new'},notes:[],emails:[],activity:[]};
const query=(data:unknown)=>({data,isPending:false,isFetching:false,isError:false,dataUpdatedAt:1,refetch:vi.fn()});
const reads={host:'host',projectId,commandQuery:query({projectId,workModel:'v2',projectWork:work,currentDesign,owner:{}}),paymentQuery:query(schedule)};
let client:QueryClient,view:ReturnType<typeof renderIntoDocument>|undefined,oldPublish:((value:ProjectOverviewEvidence|null)=>void)|undefined;
let reading:ReturnType<typeof useProjectEmailReadingState>,commercial:ReturnType<typeof useProjectCommercialContext>;
function Probe(){reading=useProjectEmailReadingState();commercial=useProjectCommercialContext();return null;}
function StatefulOwner({binding,scope,show}:{binding:Parameters<typeof OverviewTab>[0]['surface'];scope:string;show:boolean}) {
 return <ProjectCorrespondenceWarmRead projectId={projectId} enabled><ProjectCommercialProvider projectId={projectId} work={work as any} ready>
 <ProjectEmailReadingProvider scope={scope}><Probe/>{show?<OverviewTab projectId={projectId} snapshot={snapshot as any} snapshotContentReady snapshotState="fresh" host="host" surface={binding}/>:null}</ProjectEmailReadingProvider>
 </ProjectCommercialProvider></ProjectCorrespondenceWarmRead>;
}
function Fixture({owner,allowed=true,show=true,scope='customer-A'}:{owner:object;allowed?:boolean;show?:boolean;scope?:string}) {
 const controls=useOverviewControls(projectId),publication=useOwnedPortalPublication<ProjectOverviewEvidence>(allowed?owner:null);
 const binding=useMemo(()=>({controls,publish:publication.publish}),[controls,publication.publish]);
 if(allowed)oldPublish=publication.publish;
 const producer=useMemo(()=>allowed?<StatefulOwner binding={binding} scope={scope} show={show}/>:null,[allowed,binding,scope,show]);
 return <ProjectOverviewReadsProvider value={reads as any}><ProjectOverviewSurface controls={controls} evidence={publication.value} unavailable={!allowed} onFiles={()=>undefined}/>{producer}</ProjectOverviewReadsProvider>;
}
const tree=(props:Parameters<typeof Fixture>[0])=><QueryClientProvider client={client}><ToastProvider><Fixture {...props}/></ToastProvider></QueryClientProvider>;
async function settle(){for(let i=0;i<4;i++)await act(async()=>{await vi.dynamicImportSettled();await Promise.resolve();});}
function message(){return [...view!.container.querySelectorAll('details')].find(node=>node.querySelector('summary')?.textContent==='Read message')!;}
function history(){return [...view!.container.querySelectorAll('details')].find(node=>node.querySelector('summary')?.textContent?.startsWith('Earlier messages in this email'))!;}
const mail={...correspondenceFixture,messages:[{id:'reading-context',subject:'Installation question',from:'customer@example.test',sentAt:correspondenceFixture.observedAt,receivedAt:correspondenceFixture.observedAt,observedAt:correspondenceFixture.observedAt,url:'https://outlook.office.com/mail/id/reading-context',bodyText:'Please confirm the installation week. '.repeat(12)+'\nFrom: customer@example.test\nSent: Yesterday\nEarlier customer question.',truncated:false,association:'customer_address_only'}]};
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(correspondenceFixture.observedAt));mocks.api.mockReset().mockResolvedValue({state:'not_connected'});client=new QueryClient({defaultOptions:{queries:{retry:false}}});});
afterEach(()=>{view?.unmount();view=undefined;client.clear();vi.useRealTimers();vi.restoreAllMocks();});

it('preserves the SAME guarded closed/review context for actual published notices, nested design and payment consumers',async()=>{
 const owner={};view=renderIntoDocument(tree({owner}));await settle();
 const card=view.container.querySelector('[aria-label="Project Work"]'),details=[...view.container.querySelectorAll('details')];
 expect(view.container.textContent).toContain('Recorded design & price');expect(view.container.textContent).toContain('Closed project. Review invoices and payment history');
 expect(commercial.actionsAvailable).toBe(false);const review=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Review commercial actions');expect(review).toBeDefined();
 const commercialNotice=review!.closest('[data-project-read-feedback]')!;
 act(()=>review!.click());expect(commercial.actionsAvailable).toBe(true);const detailTrigger=[...commercialNotice.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Details')!;act(()=>detailTrigger.click());expect(document.body.textContent).toContain('Commercial actions are available for this review');act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.activeElement).toBe(detailTrigger);
 expect(view.container.querySelector('[aria-label="Project Work"]')).toBe(card);expect([...view.container.querySelectorAll('details')]).toEqual(details);
 const old=oldPublish!,oldReview=commercial.reviewActions;view.rerender(tree({owner,allowed:false}));expect(view.container.textContent).not.toContain('Recorded design & price');
 const fresh={};view.rerender(tree({owner:fresh}));await settle();act(()=>{old(null);oldReview();});expect(commercial.actionsAvailable).toBe(false);expect(view.container.textContent).toContain('Review commercial actions');expect(view.container.textContent).toContain('Recorded design & price');expect(view.container.querySelector('[aria-label="Project Work"]')).toBe(card);
});
it('hands the ONE guarded in-flight read to the actual published CorrespondenceQuery without a second read',async()=>{
 let resolve!:(value:unknown)=>void;mocks.api.mockImplementation(()=>new Promise(done=>{resolve=done;}));const owner={};
 view=renderIntoDocument(tree({owner,show:false}));await settle();expect(mocks.api).toHaveBeenCalledOnce();const signal=mocks.api.mock.calls[0][1].signal;
 view.rerender(tree({owner,show:true}));await settle();expect(mocks.api).toHaveBeenCalledOnce();
 await act(async()=>resolve({state:'ready',context:mail}));await settle();expect(view.container.textContent).toContain('Please confirm the installation week');
 view.rerender(tree({owner,allowed:false}));expect(signal.aborted).toBe(true);expect(view.container.textContent).not.toContain('Please confirm the installation week');
});
it('shares message/history disclosure state with the actual Query/Card/Reader and resets ONLY that reading scope on identity change',async()=>{
 mocks.api.mockResolvedValue({state:'ready',context:mail});const owner={};view=renderIntoDocument(tree({owner}));await settle();
 expect(message()).toBeDefined();act(()=>{message().open=true;message().dispatchEvent(new Event('toggle'));});act(()=>{history().open=true;history().dispatchEvent(new Event('toggle'));});
 expect(reading.open.has('message:reading-context')).toBe(true);expect(reading.open.has('history:reading-context')).toBe(true);const staleClear=reading.clear;
 const card=view.container.querySelector('[aria-label="Project Work"]');const prior=mocks.api.mock.calls.length;let resolve!:(reply:unknown)=>void;mocks.api.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 view.rerender(tree({owner,scope:'customer-B'}));await settle();expect(mocks.api).toHaveBeenCalledTimes(prior+1);expect(reading.scope).toBe('customer-B');expect(reading.open.size).toBe(0);expect(view.container.textContent).not.toContain('Please confirm the installation week');expect(view.container.querySelector('[aria-label="Project Work"]')).toBe(card);
 await act(async()=>resolve({state:'ready',context:mail}));await settle();expect(message().open).toBe(false);act(()=>{message().open=true;message().dispatchEvent(new Event('toggle'));});expect(reading.open.has('message:reading-context')).toBe(true);
 act(()=>staleClear());expect(reading.open.has('message:reading-context')).toBe(true);
});
