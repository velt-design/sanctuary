import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import RootLayout from '@/app/layout';
import StaffLayout from '@/app/staff/layout';
import StudioEditPage from '@/app/staff/design-studio/[projectId]/[estimateId]/edit/page';
import StudioReviewPage from '@/app/staff/design-studio/[projectId]/[estimateId]/page';
const mocks=vi.hoisted(()=>({headers:vi.fn(),guard:vi.fn(),normal:vi.fn(),db:vi.fn()}));
vi.mock('next/headers',()=>({headers:mocks.headers}));
vi.mock('next/font/local',()=>({default:()=>({variable:'public-font'})}));
vi.mock('next/navigation',()=>({notFound:()=>{throw Error('not-found');}}));
vi.mock('@/lib/auth',()=>({requireStaffPageAccess:mocks.guard,requireRegionalDocumentAccess:vi.fn(),getPortalAccessState:async()=>({kind:'unauthenticated'})}));
vi.mock('@/lib/performance/documentRenderDiagnostics',()=>({getDocumentRenderDiagnostics:async()=>null}));
vi.mock('@/lib/xero/pilotAccess',()=>({getPaymentPilotSession:async()=>null,paymentPilotEnabled:()=>false}));
vi.mock('@/lib/theme/server',()=>({loadPortalThemeForUser:async()=>null,portalThemeStyleVars:()=>({})}));
vi.mock('@/components/auth/PortalAuthProvider',()=>({default:({children}:any)=><>{children}</>}));
vi.mock('@/app/providers',()=>({Providers:({children}:any)=><>{children}</>}));
vi.mock('@/components/performance/PortalVitalsReporter',()=>({default:()=>null}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({ToastProvider:({children}:any)=><>{children}</>}));
vi.mock('@/components/layout/PortalShell',()=>({default:(props:any)=>{mocks.normal(props);return <main>normal authenticated Portal environment{props.children}</main>;}}));
vi.mock('@/components/designStudio/StudioDocumentSlot',()=>({default:({callback,children}:{callback:string;children:React.ReactNode})=><main data-studio-document={callback}>Design Studio{children}</main>}));
vi.mock('@/components/designStudio/StudioDocumentPage',()=>({default:({callback}:{callback:string})=><main data-document-page={callback}>Opening saved design</main>}));
vi.mock('@/components/designStudio/StudioAuthoringLoader',()=>({default:()=>null}));
vi.mock('@/components/designStudio/StudioReviewDocumentPage',()=>({default:({callback}:{callback:string})=><main data-review-document={callback}>Opening saved design</main>}));
vi.mock('@/components/designStudio/SavedStudioReviewLoader',()=>({default:()=><main>protected Review</main>}));
vi.mock('@/components/sync/DbGate',()=>({default:()=>{mocks.db();return null;}}));
const projectId='proj_10000000-0000-4000-8000-000000000001',estimateId='est_20000000-0000-4000-8000-000000000001',callback=`/staff/design-studio/${projectId}/${estimateId}/edit`;
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');mocks.headers.mockResolvedValue(new Headers({'x-sanctuary-studio-callback':callback}));});
afterEach(()=>vi.unstubAllEnvs());
it('delegates only public exact-page props to the generic frame without resolving the normal private environment or guard',async()=>{
 const page=await StudioEditPage({params:Promise.resolve({projectId,estimateId}),searchParams:Promise.resolve({})});expect(page.props).toEqual({callback});
 const element=await RootLayout({children:page}),html=renderToStaticMarkup(element);
 expect(html).toContain('Design Studio');expect(html).not.toMatch(/private-actor|private-theme|private-quote/);expect(mocks.normal).not.toHaveBeenCalled();
 renderToStaticMarkup(await StaffLayout({children:<div>generic page</div>}));expect(mocks.guard).not.toHaveBeenCalled();expect(mocks.db).not.toHaveBeenCalled();
 expect(renderToStaticMarkup(page)).toContain('data-document-page');expect(mocks.guard).not.toHaveBeenCalled();
});
it.each(['?intent=revision','?intent=duplicate&name=Courtyard'])('preserves the normal protected creation environment for %s',async query=>{
 mocks.headers.mockResolvedValue(new Headers({'x-sanctuary-studio-callback':callback+query}));
 renderToStaticMarkup(await RootLayout({children:null}));expect(mocks.normal).toHaveBeenCalledOnce();await StaffLayout({children:null});expect(mocks.guard).toHaveBeenCalledWith(callback+query);
});
it.each(['/admin/imports','/staff/design-studio/raw/raw/edit',callback+'?unknown=x'])('never turns a malformed routing hint into a public document: %s',async hint=>{
 mocks.headers.mockResolvedValue(new Headers({'x-sanctuary-studio-callback':hint}));renderToStaticMarkup(await RootLayout({children:null}));expect(mocks.normal).toHaveBeenCalledOnce();
});
it('does not skip a guard when the page target differs from the independently validated hint',async()=>{
 await StudioEditPage({params:Promise.resolve({projectId,estimateId:'est_20000000-0000-4000-8000-000000000002'}),searchParams:Promise.resolve({})});expect(mocks.guard).toHaveBeenCalledOnce();
});

it.each([undefined,'qv_30000000-0000-4000-8000-000000000001'])('keeps Review public HTML to routing props before fresh API admission: %s',async quoteVersionId=>{
 const review=callback.replace('/edit','')+(quoteVersionId?`?quoteVersionId=${quoteVersionId}`:'');
 mocks.headers.mockResolvedValue(new Headers({'x-sanctuary-studio-callback':review}));
 const page=await StudioReviewPage({params:Promise.resolve({projectId,estimateId}),searchParams:Promise.resolve(quoteVersionId?{quoteVersionId}:{})});
 expect(page.props).toEqual({callback:review,projectId,estimateId,quoteVersionId});
 const html=renderToStaticMarkup(await RootLayout({children:await StaffLayout({children:page})}));
 expect(html).toContain('data-review-document');expect(html).not.toMatch(/actor|email|role|finance|theme|price|quoteDocument/);
 expect(mocks.normal).not.toHaveBeenCalled();expect(mocks.guard).not.toHaveBeenCalled();expect(mocks.db).not.toHaveBeenCalled();
});

it.each(['?studioView=protected','?unknown=x','?quoteVersionId=bad'])('retains the protected normal environment for Review %s',async query=>{
 mocks.headers.mockResolvedValue(new Headers({'x-sanctuary-studio-callback':callback.replace('/edit','')+query}));
 renderToStaticMarkup(await RootLayout({children:null}));await StaffLayout({children:null});
 expect(mocks.normal).toHaveBeenCalledOnce();expect(mocks.guard).toHaveBeenCalledWith('/staff');
});
