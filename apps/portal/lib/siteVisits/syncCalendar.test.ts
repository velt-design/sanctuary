// @vitest-environment node
import { beforeEach,describe,it,expect,vi } from 'vitest';
const h=vi.hoisted(()=>({rpc:vi.fn(),graph:vi.fn(),normalize:vi.fn()}));
vi.mock('@/lib/supabaseClient',()=>({supabaseServiceRole:{rpc:h.rpc}}));
vi.mock('./config',()=>({outlookCalendarConfig:()=>({binding:'pinned-binding',staffEmails:new Set(),mailbox:'office@example.invalid'})}));
vi.mock('./graphCalendar',async original=>({...await original<typeof import('./graphCalendar')>(),readGraphCalendar:h.graph}));
vi.mock('./normalizeCalendar',()=>({normalizeCalendar:h.normalize}));
import { syncOutlookCalendar } from './syncCalendar';
beforeEach(()=>{vi.clearAllMocks();h.rpc.mockImplementation(async(_name,args)=>({error:null,data:args.p_action==='claim'?{claimed:true}:{published:true}}));h.graph.mockResolvedValue([]);h.normalize.mockReturnValue([]);});
describe('Calendar sync publication boundary',()=>{
 it('does not contact Graph when a lease or cooldown denies the run',async()=>{h.rpc.mockResolvedValueOnce({data:{claimed:false,reason:'busy'},error:null});expect(await syncOutlookCalendar('assertion')).toEqual({updated:false,reason:'busy'});expect(h.graph).not.toHaveBeenCalled();});
 it('never publishes or advances success after a failed source read or normalization',async()=>{
   h.graph.mockRejectedValueOnce(new Error('raw provider error with sensitive data'));await expect(syncOutlookCalendar('assertion')).rejects.toThrow('SOURCE_INVALID');
   expect(h.rpc.mock.calls.map(c=>c[1].p_action)).toEqual(['claim','fail']);expect(h.rpc.mock.calls[1][1].p_input).toEqual({code:'SYNC_FAILED'});
   h.rpc.mockClear();h.normalize.mockImplementationOnce(()=>{throw new Error('bad event');});await expect(syncOutlookCalendar('assertion')).rejects.toThrow();expect(h.rpc.mock.calls.map(c=>c[1].p_action)).toEqual(['claim','fail']);
 });
 it('publishes only sanitized normalized events and hides private former identities',async()=>{
   h.graph.mockResolvedValue([{id:'private-immutable',iCalUId:'private-uid',sensitivity:'private',body:{content:'private notes'}}]);
   expect(await syncOutlookCalendar('assertion')).toEqual({updated:true,count:0});const input=h.rpc.mock.calls[1][1].p_input;
   expect(input).toMatchObject({events:[],hiddenKeys:['private-uid'],sourceCount:1});expect(JSON.stringify(input)).not.toContain('private notes');expect(h.rpc.mock.calls.every(c=>c[1].p_binding==='pinned-binding')).toBe(true);
 });
});
