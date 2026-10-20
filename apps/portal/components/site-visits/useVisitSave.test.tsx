import { act } from 'react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import { useVisitSave } from './useVisitSave';
const mock=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('@/lib/repo/apiClient',()=>({apiJson:mock.api}));
const id='00000000-0000-4000-8000-000000000001';
const projectId='00000000-0000-4000-8000-000000000002';
const original:CalendarVisit={id,revision:2,projectId,staff:[],origin:'outlook',
  sourceKey:'synthetic',subject:'Synthetic visit',startsAt:'2026-10-20T00:00:00Z',endsAt:'2026-10-20T01:00:00Z',
  isAllDay:false,allDayStartDate:null,allDayEndDate:null,sourceUrl:null,address:null,assignmentHint:null,
  kind:'visit',sourceKind:'visit',cancelled:false,removed:false,duplicate:false,reviewReasons:[],
  projectName:'Synthetic project',contactName:null,phone:null,linkMode:'manual',kindOverride:null};
let state:ReturnType<typeof useVisitSave>;
let mounted:ReturnType<typeof renderIntoDocument>;
let client:QueryClient;
let done=vi.fn<()=>void>();
function mount(visit:CalendarVisit|null=original){
  done=vi.fn();
  function Harness(){state=useVisitSave({visit:visit??undefined,id,projectId,onDone:done});return <div/>;}
  mounted=renderIntoDocument(<QueryClientProvider client={client}><Harness/></QueryClientProvider>);
}
const postCount=()=>mock.api.mock.calls.filter(call=>call[1]?.method==='POST').length;
const input=()=>({id,revision:state.revision,details:{basis:'Retained synthetic draft'}});
async function flush(){await act(async()=>{await Promise.resolve();});}
beforeEach(()=>{vi.useFakeTimers();mock.api.mockReset();client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});});
afterEach(()=>{mounted?.unmount();client.clear();vi.useRealTimers();});
describe('bounded site-visit save recovery',()=>{
  it('releases a hung POST after20s and ignores a late success without closing or allowing another write',async()=>{
    let resolve!:(value:unknown)=>void;
    mock.api.mockImplementation(()=>new Promise(yes=>{resolve=yes;}));
    mount();act(()=>{void state.save('/corrections',input());});
    expect(state.pending).toBe(true);
    await act(async()=>{await vi.advanceTimersByTimeAsync(20_000);});
    expect(state.pending).toBe(false);expect(state.recovery?.outcome).toBe('unknown');expect(state.blocked).toBe(true);
    expect(mock.api.mock.calls[0][1].signal.aborted).toBe(true);
    act(()=>{void state.save('/corrections',input());});
    expect(postCount()).toBe(1);
    await act(async()=>resolve({visit:{...original,revision:3}}));
    expect(done).not.toHaveBeenCalled();expect(state.revision).toBe(2);expect(state.recovery?.outcome).toBe('unknown');
  });
  it('requires a successful latest read and explicit revision acknowledgement before another write',async()=>{
    mock.api.mockRejectedValue(new Error('Transport failed'));
    mount();act(()=>{void state.save('/corrections',input());});await flush();
    await act(async()=>state.reload());
    act(()=>state.acknowledge());
    expect(state.blocked).toBe(true);expect(state.recovery?.ready).toBe(false);
    mock.api.mockResolvedValue({events:[{...original,revision:4}]});
    await act(async()=>state.reload());
    expect(state.blocked).toBe(true);expect(state.revision).toBe(2);
    act(()=>state.acknowledge());
    expect(state.blocked).toBe(false);expect(state.revision).toBe(4);expect(postCount()).toBe(1);
  });
  it('bounds a failed refresh separately and reports a confirmed save',async()=>{
    mock.api.mockImplementation((_path,options)=>options?.method==='POST'?Promise.resolve({visit:{...original,revision:3}}):new Promise(()=>{}));
    mount();act(()=>{void state.save('/corrections',input());});await flush();
    expect(state.revision).toBe(3);
    await act(async()=>{await vi.advanceTimersByTimeAsync(20_000);});
    expect(state.pending).toBe(false);expect(state.recovery?.outcome).toBe('saved');expect(state.blocked).toBe(true);
    expect(done).not.toHaveBeenCalled();expect(postCount()).toBe(1);
    mock.api.mockResolvedValue({events:[original]});
    await act(async()=>state.reload());expect(state.recovery?.ready).toBe(false);expect(state.revision).toBe(3);
  });
  it('finds an uncertain historical create by the held ID and uses its saved revision',async()=>{
    mock.api.mockRejectedValue(new Error('No response'));
    mount(null);
    act(()=>{void state.save('/history',input());});await flush();
    mock.api.mockResolvedValue({events:[{...original,origin:'history',revision:1}]});
    await act(async()=>state.reload());act(()=>state.acknowledge());
    expect(state.revision).toBe(1);expect(state.current?.id).toBe(id);expect(state.blocked).toBe(false);
    expect(JSON.parse(mock.api.mock.calls[0][1].body).id).toBe(id);
  });
  it('retries an absent historical create with the same ID/revision0, leaving late-commit fencing to SQL',async()=>{
    mock.api.mockRejectedValue(new Error('No response'));
    mount(null);
    act(()=>{void state.save('/history',input());});await flush();
    mock.api.mockResolvedValue({events:[]});
    await act(async()=>state.reload());act(()=>state.acknowledge());
    expect(state.revision).toBe(0);expect(state.blocked).toBe(false);
    mock.api.mockImplementation((_path,options)=>options?.method==='POST'?Promise.resolve({visit:{...original,origin:'history',revision:1}}):Promise.resolve({events:[{...original,origin:'history',revision:1}]}));
    act(()=>{void state.save('/history',input());});await flush();
    const commands=mock.api.mock.calls.filter(call=>call[1]?.method==='POST').map(call=>JSON.parse(call[1].body));
    expect(commands.map(command=>({id:command.id,revision:command.revision}))).toEqual([{id,revision:0},{id,revision:0}]);
    expect(done).toHaveBeenCalledOnce();
  });
  it('does not infer create absence from a failed scope and resolves a move from the global read',async()=>{
    mock.api.mockRejectedValue(new Error('No response'));mount();act(()=>{void state.save('/corrections',input());});await flush();
    mock.api.mockImplementation(path=>path.includes('?')?Promise.resolve({events:[]}):Promise.reject(new Error('Read failed')));
    await act(async()=>state.reload());expect(state.recovery?.ready).toBe(false);
    mock.api.mockImplementation(path=>Promise.resolve({events:path.includes('?')?[]:[{...original,projectId:'moved',revision:5}]}));
    await act(async()=>state.reload());act(()=>state.acknowledge());
    expect(state.revision).toBe(5);expect(state.blocked).toBe(false);
  });
});
