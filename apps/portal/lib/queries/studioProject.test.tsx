import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireStaffContext: vi.fn() }));
const projectAuth = vi.hoisted(() => ({ getSupabaseServerAuth: vi.fn() }));
vi.mock('@/lib/api/staffApi', () => auth);
vi.mock('@/lib/supabase/serverClient', () => projectAuth);
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('@/components/designStudio/StudioNewDesign', () => ({
  default: ({ projectId }: { projectId: string }) => <div data-new-design={projectId} />,
}));
import StudioProjectPage from '@/app/staff/projects/[projectId]/studio/page';
import {loadStudioProject,loadStudioProjectName} from './studioProject.server';
import {loadProjectEstimateMetas} from '@/lib/estimates/loadProjectEstimateMetas';

const projectUuid = '11111111-1111-4111-8111-111111111111';
const firstUuid = '22222222-2222-4222-8222-222222222222';
const secondUuid = '33333333-3333-4333-8333-333333333333';
const projectId = `proj_${projectUuid}`;
const page = async () => renderToStaticMarkup(await StudioProjectPage({ params: Promise.resolve({ projectId }) }));

function client(project: unknown = { id: projectUuid, name: 'Exact project' }, rows: unknown[] = [], error: unknown = null) {
  const projectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: project }) };
  projectQuery.select.mockReturnValue(projectQuery);
  projectQuery.eq.mockReturnValue(projectQuery);
  let estimateColumns:string[]=[];
  const estimateQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn().mockImplementation(async()=>({
    data:rows.map(value=>Object.fromEntries(Object.entries(value as Record<string,unknown>).filter(([key])=>estimateColumns.includes(key)))),error,
  })) };
  // Match real Supabase projection: undeclared legacy fields must not leak into a query fixture.
  estimateQuery.select.mockImplementation((columns:string)=>{estimateColumns=columns.split(',').map(x=>x.trim());return estimateQuery;});
  estimateQuery.eq.mockReturnValue(estimateQuery);
  const relatedQuery={select:vi.fn(),in:vi.fn().mockResolvedValue({data:[],error:null})};relatedQuery.select.mockReturnValue(relatedQuery);
  const supabase = { from: vi.fn((table: string) => table === 'projects' ? projectQuery : table === 'estimates' ? estimateQuery : relatedQuery) };
  auth.requireStaffContext.mockResolvedValue({ ok: true, session: { role: 'staff' }, supabase });
  projectAuth.getSupabaseServerAuth.mockResolvedValue(supabase);
  return { supabase, projectQuery, estimateQuery, relatedQuery };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO', '1');
});
afterEach(() => vi.unstubAllEnvs());

it('does not authenticate or read data when the feature is disabled', async () => {
  vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO', '0');
  await expect(page()).rejects.toThrow('NOT_FOUND');
  expect(auth.requireStaffContext).not.toHaveBeenCalled();
});

it.each([null, 'installer'])('refuses missing or non-staff access before querying (%s)', async role => {
  const { supabase } = client();
  auth.requireStaffContext.mockResolvedValue(role ? { ok: true, session: { role }, supabase } : { ok: false });
  await expect(page()).rejects.toThrow('NOT_FOUND');
  expect(supabase.from).not.toHaveBeenCalled();
});

it.each(['staff', 'admin'])('uses the authenticated %s client and preserves project filtering, order and links', async role => {
  const { supabase, projectQuery, estimateQuery } = client(undefined, [
    { id: firstUuid, version: 2, internal_name: 'Saved draft', status: 'draft', created_at:'2026-10-21T00:00:00Z', outputs: { studio_authored: {} } },
    { id: '44444444-4444-4444-8444-444444444444', version: 8, internal_name: 'Calculator only', status: 'draft', outputs: {} },
    { id: secondUuid, version: 1, internal_name: null, status: 'archived', created_at:'2026-10-20T00:00:00Z', outputs: { studio_authored: {} } },
  ]);
  auth.requireStaffContext.mockResolvedValue({ ok: true, session: { role }, supabase });
  const html = await page();
  expect(supabase.from.mock.calls).toEqual([['projects'], ['estimates'], ['quote_versions'], ['job_pack_generations']]);
  expect(projectQuery.select).toHaveBeenCalledWith('id,name');
  expect(projectQuery.eq).toHaveBeenCalledWith('id', projectUuid);
  expect(estimateQuery.select).toHaveBeenCalledWith('id,internal_name,status,outputs,created_at,commercial_scope_id');
  expect(estimateQuery.eq).toHaveBeenCalledWith('project_id', projectUuid);
  expect(estimateQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
  expect(html).toContain('Exact project');
  expect(html).toContain(`data-new-design="${projectId}"`);
  expect(html).toContain(`/staff/design-studio/${projectId}/est_${firstUuid}/edit`);
  expect(html).toContain(`/staff/design-studio/${projectId}/est_${secondUuid}"`);
  expect(html.indexOf('Saved draft')).toBeLessThan(html.indexOf('Untitled Studio design'));
  expect(html).not.toContain('Calculator only');
});

it('does not query estimates when the authenticated project read is not visible', async () => {
  const { supabase, estimateQuery } = client(null);
  await expect(page()).rejects.toThrow('NOT_FOUND');
  expect(supabase.from.mock.calls).toEqual([['projects']]);
  expect(estimateQuery.order).not.toHaveBeenCalled();
});

it('retains the retry alert rather than showing an empty list on estimate-read failure', async () => {
  client(undefined, [], { message: 'read failed' });
  const html = await page();
  expect(html).toContain('role="alert"');
  expect(html).toContain('Saved designs could not be loaded. Reload to retry.');
  expect(html).not.toContain('Create your first design');
});

it('retains the empty state and propagates transport rejection', async () => {
  const { estimateQuery } = client();
  expect(await page()).toContain('Create your first design for this project.');
  estimateQuery.order.mockRejectedValueOnce(new Error('transport failed'));
  await expect(page()).rejects.toThrow('transport failed');
});

it('distinguishes same-name quoted and editable versions using the existing flow authority',async()=>{
 const {relatedQuery}=client(undefined,[
  {id:firstUuid,status:'draft',internal_name:'Courtyard',created_at:'2026-10-21T00:00:00Z',outputs:{studio_authored:{}}},
  {id:secondUuid,status:'draft',internal_name:'Courtyard',created_at:'2026-10-20T00:00:00Z',outputs:{studio_authored:{}}},
 ]);
 relatedQuery.in.mockResolvedValueOnce({data:[{id:'quote-1',source_estimate_version_id:secondUuid,status:'SENT',sent_at:'2026-10-20T06:00:00Z',version_number:3,quotes:{quote_ref:'Q-1093'}}],error:null});
 const html=await page();
 expect(html).toContain('Design V2');expect(html).toContain('Design V1');expect(html).toContain('quote revision 3');expect(html).toContain('Used by a quote');
 expect(html).toContain(`/est_${firstUuid}/edit`);expect(html).not.toContain(`/est_${secondUuid}/edit`);expect(html).toContain('Review saved design');
});

it('never displays a mismatched or failed Project identity read',async()=>{
 const {supabase,projectQuery}=client({id:secondUuid,name:'Other project'});
 expect(await loadStudioProjectName(supabase as any,projectUuid)).toBeNull();
 projectQuery.maybeSingle.mockResolvedValueOnce({data:{id:projectUuid,name:'Private name'},error:{message:'unavailable'}} as any);
 expect(await loadStudioProjectName(supabase as any,projectUuid)).toBeNull();
 expect(projectQuery.eq).toHaveBeenCalledWith('id',projectUuid);
});

it('keeps review accessible without inventing editability when quote history cannot be read',async()=>{
 const {relatedQuery}=client(undefined,[{id:firstUuid,status:'draft',internal_name:'Retained design',created_at:'2026-10-21T00:00:00Z',outputs:{studio_authored:{}}}]);
 relatedQuery.in.mockResolvedValueOnce({data:null,error:{message:'unavailable'}} as any);
 const html=await page();expect(html).toContain('Retained design');expect(html).toContain('Quote history unavailable');expect(html).toContain('Review saved design');expect(html).not.toContain(`/est_${firstUuid}/edit`);
});

it('matches canonical Project versions across mixed Studio/calculator rows with a missing legacy snapshot version',async()=>{
 const rows=Array.from({length:7},(_,index)=>({
  id:`44444444-4444-4444-8444-${String(index+1).padStart(12,'0')}`,project_id:projectUuid,
  version:Math.max(1,index),internal_name:index?'Same-name Studio':'Legacy calculator',status:'draft',
  created_at:`2026-10-${String(index+10).padStart(2,'0')}T00:00:00Z`,
  outputs:index?{version:index,studio_authored:{}}:{},
 })).reverse();
 const before=structuredClone(rows),{supabase}=client(undefined,rows);
 const studio=await loadStudioProject(supabase as any,projectUuid);
 const project=await loadProjectEstimateMetas(projectId);
 expect(project.find(row=>row.id===`est_${rows[0].id}`)?.versionLabel).toBe('V7');
 expect(studio?.designs.map(({id,versionLabel})=>({id,versionLabel}))).toEqual(project.filter(row=>row.designKind==='studio').map(({id,versionLabel})=>({id,versionLabel})));
 expect(studio?.designs.map(row=>row.versionLabel)).toEqual(['V7','V6','V5','V4','V3','V2']);
 expect(rows).toEqual(before);
});

it.each([true,false])('matches Project authority before Studio filtering with snapshot versions present=%s',async explicit=>{
 const rows=[
  {id:firstUuid,project_id:projectUuid,version:1,status:'draft',internal_name:'Studio',created_at:'2026-10-21T00:00:00Z',outputs:{studio_authored:{},...(explicit?{version:19}:{})}},
  {id:secondUuid,project_id:projectUuid,version:12,status:'draft',internal_name:'Calculator',created_at:'2026-10-20T00:00:00Z',outputs:explicit?{version:12}:{}},
 ];
 const {supabase}=client(undefined,rows);
 const studio=await loadStudioProject(supabase as any,projectUuid),project=await loadProjectEstimateMetas(projectId);
 expect(studio?.designs).toHaveLength(1);
 expect(studio?.designs[0].versionLabel).toBe(explicit?'V19':'V2');
 expect(studio?.designs[0].versionLabel).toBe(project.find(row=>row.id===`est_${firstUuid}`)?.versionLabel);
});
