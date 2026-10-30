import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import StudioEditPage from '../../app/staff/design-studio/[projectId]/[estimateId]/edit/page';
import StaffLayout from '../../app/staff/layout';
const mocks=vi.hoisted(()=>({guard:vi.fn(),headers:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireStaffPageAccess:mocks.guard}));
vi.mock('next/headers',()=>({headers:mocks.headers}));
vi.mock('next/navigation',()=>({notFound:()=>{throw Error('not-found');}}));
vi.mock('@/components/designStudio/StudioAuthoringLoader',()=>({default:()=>null}));
vi.mock('@/components/sync/DbGate',()=>({default:()=>null}));
const projectId='proj_10000000-0000-4000-8000-000000000001',estimateId='est_20000000-0000-4000-8000-000000000001';
const callback=`/staff/design-studio/${projectId}/${estimateId}/edit?intent=duplicate&name=Courtyard`;
beforeEach(()=>{vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');mocks.guard.mockReset();mocks.headers.mockResolvedValue(new Headers({'x-sanctuary-studio-callback':callback}));});
afterEach(()=>vi.unstubAllEnvs());
it('executes explicit fresh page admission on each entry even when ancestor layouts are reused',async()=>{
 for(let i=0;i<2;i++)await StudioEditPage({params:Promise.resolve({projectId,estimateId}),searchParams:Promise.resolve({intent:'duplicate',name:'Courtyard'})});
 expect(mocks.guard).toHaveBeenCalledTimes(2);expect(mocks.guard).toHaveBeenLastCalledWith(callback);
});
it('does not return a loader when current page admission denies the previously signed user',async()=>{
 mocks.guard.mockRejectedValue(Error('current-role-denial'));
 await expect(StudioEditPage({params:Promise.resolve({projectId,estimateId}),searchParams:Promise.resolve({})})).rejects.toThrow('current-role-denial');
});
it('gives the ancestor guard the same validated full callback',async()=>{
 await StaffLayout({children:null});expect(mocks.guard).toHaveBeenCalledExactlyOnceWith(callback);
});
it.each(['/admin/imports','//outside.invalid/staff','/staff/design-studio/raw/raw/edit'])('keeps forged ancestor callback %s on its existing staff fallback',async value=>{
 mocks.headers.mockResolvedValue(new Headers({'x-sanctuary-studio-callback':value}));await StaffLayout({children:null});expect(mocks.guard).toHaveBeenCalledExactlyOnceWith('/staff');
});
it('retains the existing staff fallback when Studio is disabled',async()=>{
 vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','');await StaffLayout({children:null});expect(mocks.guard).toHaveBeenCalledExactlyOnceWith('/staff');
});
it.each([{intent:['edit']},{name:'Name'},{intent:'other'},{unknown:'x'}])('rejects malformed page queries before a loader or guard',async query=>{
 await expect(StudioEditPage({params:Promise.resolve({projectId,estimateId}),searchParams:Promise.resolve(query)})).rejects.toThrow('not-found');expect(mocks.guard).not.toHaveBeenCalled();
});
