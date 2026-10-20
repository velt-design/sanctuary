// @vitest-environment node
import { beforeEach,describe,it,expect,vi } from 'vitest';
const h=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/api/staffApi',()=>({requireStaffContext:h.auth}));
vi.mock('@/lib/siteVisits/config',()=>({outlookPortalOrigin:()=> 'https://portal.example.test'}));
vi.mock('server-only',()=>({}));
import { POST } from './route';
import { POST as saveHistory } from '../history/route';
const id='00000000-0000-4000-8000-000000000001';
const input={action:'save',id,revision:1,projectId:null,linkMode:'manual',kind:'visit',details:{staff:[{name:'Jordan',email:'',staffId:'jordan'}]},questions:[],basis:'Confirmed by the original staff member.',referenceUrl:null};
const request=(body:unknown=input,origin='https://portal.example.test')=>new Request('https://portal.example.test/api/staff/v1/outlook-site-visits/corrections',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{h.auth.mockReset();h.rpc.mockReset();h.auth.mockResolvedValue({ok:true,supabase:{rpc:h.rpc}});h.rpc.mockResolvedValue({data:{id,staff:[],reviewReasons:[]},error:null});});
describe('Staff correction boundary',()=>{
 it('rejects unknown or forged roster identities before a write',async()=>{
  for(const person of [{name:'Unknown',email:'',staffId:'unknown'},{name:'Someone else',email:'',staffId:'jordan'},{name:'Jordan',email:'invented@example.test',staffId:'jordan'},{name:'Jordan',email:''}]){
   expect((await POST(request({...input,details:{staff:[person]}}))).status).toBe(400);
  }
  expect(h.rpc.mock.calls.filter(c=>c[0]==='site_visit_correct')).toHaveLength(0);
 });
 it('accepts only saved recognised Outlook identities, never correction-supplied identities',async()=>{
  const person={name:'Jordan Synthetic Fullname',email:'original-rep@example.test',staffId:'jordan'};
  h.rpc.mockImplementation(async(name)=>name==='outlook_site_visits_read'?{data:{events:[{origin:'outlook',staff:[person],correction:{details:{staff:[{name:'Forged',email:'forged@example.test'}]}}}]},error:null}:{data:{id,staff:[],reviewReasons:[]},error:null});
  expect((await POST(request({...input,details:{staff:[person]}}))).status).toBe(200);
  expect((await POST(request({...input,details:{staff:[{...person,name:'Forged label'}]}}))).status).toBe(400);
  expect((await POST(request({...input,details:{staff:[{...person,staffId:'joe'}]}}))).status).toBe(400);
  expect((await POST(request({...input,details:{staff:[{name:'Forged',email:'forged@example.test'}]}}))).status).toBe(400);
  expect(h.rpc.mock.calls.filter(c=>c[0]==='site_visit_correct')).toHaveLength(1);
 });
 it('requires staff and exact origin before issuing any RPC',async()=>{
  h.auth.mockResolvedValueOnce({ok:false});expect((await POST(request())).status).toBe(401);expect((await POST(request(input,'https://wrong.example.test'))).status).toBe(403);expect(h.rpc).not.toHaveBeenCalled();
 });
 it('validates the strict command and routes only to the dedicated audited correction RPC',async()=>{
  expect((await POST(request({...input,sendEmail:true}))).status).toBe(400);expect(h.rpc).not.toHaveBeenCalled();
  const result=await POST(request());expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toBe('private, no-store');expect(h.rpc).toHaveBeenCalledExactlyOnceWith('site_visit_correct',{p_input:input});
 });
 it('keeps conflicts safe and does not expose underlying database content',async()=>{
  h.rpc.mockResolvedValue({error:{code:'40001',message:'sensitive underlying value'},data:null});const response=await POST(request());expect(response.status).toBe(409);expect(await response.text()).not.toContain('sensitive');
 });
 it('allows explicit unknown-date history through its separate command, never legacy booking APIs',async()=>{
  const historical={action:'save',id,revision:0,projectId:id,details:{staff:input.details.staff,status:'attended',purpose:'initial',timing:{mode:'unknown',date:null,time:null,endTime:null}},questions:[],basis:input.basis,referenceUrl:null};
  expect((await saveHistory(request(historical))).status).toBe(200);expect(h.rpc).toHaveBeenCalledExactlyOnceWith('site_visit_history_save',{p_input:historical});
  expect((await saveHistory(request({...historical,details:{...historical.details,staff:[]}}))).status).toBe(400);
 });
});
