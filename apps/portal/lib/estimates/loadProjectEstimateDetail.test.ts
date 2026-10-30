import {beforeEach,expect,it,vi} from 'vitest';
import {emptyEstimateEditability} from './editability';
import {buildVersionLabelMap} from './server';
import {loadProjectEstimateDetail} from './loadProjectEstimateDetail';
const mocks=vi.hoisted(()=>({auth:vi.fn(),flow:vi.fn()}));
vi.mock('@/lib/supabase/serverClient',()=>({getSupabaseServerAuth:mocks.auth}));
vi.mock('@/lib/supabaseClient',()=>({supabaseServiceRole:{}}));
vi.mock('./flow',async load=>({...await load<typeof import('./flow')>(),loadProjectEstimateFlowMaps:mocks.flow}));
const project='10000000-0000-4000-8000-000000000001',target='20000000-0000-4000-8000-000000000001';
type Row={id:string;created_at?:string;version?:unknown;outputs?:unknown};
let history:Row[],labelSelection:string,labelFailure:Error|null,targetRow:Record<string,unknown>|null;
const requests:{table:string;fields:string;filters:[string,string][];order?:unknown}[]=[];
const client={from:vi.fn((table:string)=>{
  const request={table,fields:'',filters:[] as [string,string][],order:undefined as unknown};requests.push(request);
  const query={select(fields:string){request.fields=fields;return query;},eq(field:string,value:string){request.filters.push([field,value]);return query;},
    async maybeSingle(){return{data:targetRow,error:null};},async order(field:string,options:unknown){request.order={field,options};labelSelection=request.fields;
      if(labelFailure)return{data:null,error:labelFailure};
      return{error:null,data:history.map(row=>request.fields==='id, created_at, version:outputs->version'
        ?{id:row.id,created_at:row.created_at,version:(row.outputs as {version?:unknown}|null)?.version??null}
        :{id:row.id,created_at:row.created_at,outputs:row.outputs})};}};
  return query;
})};
beforeEach(()=>{
  vi.clearAllMocks();requests.length=0;labelSelection='';labelFailure=null;
  targetRow={id:target,project_id:project,status:'draft',created_at:'2026-10-02',updated_at:'2026-10-03',outputs:{version:2,preservedRaw:'0.00'},inputs:{},summary:{total:123},internal_notes:'retained'};
  history=[];mocks.auth.mockResolvedValue(client);
  mocks.flow.mockResolvedValue({activeDraftEstimateId:target,editabilityByEstimateId:new Map([[target,emptyEstimateEditability()]]),flowByEstimateId:new Map()});
});
it.each([
  {name:'numeric snapshot versions over stale physical defaults',rows:[{id:target,created_at:'2026-10-02',version:1,outputs:{version:2,opaque:'not needed'}},{id:'older',created_at:'2026-10-01',version:99,outputs:{version:8}}]},
  {name:'invalid/missing JSON values without top-level fallback',rows:[{id:target,created_at:'2026-10-03',version:99,outputs:{version:'2'}},{id:'older',created_at:'2026-10-01',version:88,outputs:null},{id:'middle',created_at:'2026-10-02',outputs:{version:1.5}}]},
  {name:'stable missing/tied date fallback',rows:[{id:target,outputs:{version:0}},{id:'same',outputs:{version:true}},{id:'last',created_at:'2026-10-01',outputs:{}}]},
  {name:'empty label list',rows:[]},
])('loads the same detail/label with only the version JSON projection: $name',async({rows})=>{
  history=rows;
  // The old query did not select the physical version column. Preserve that
  // exact projection as the label oracle, including all-or-date fallback.
  const expected=buildVersionLabelMap(rows.map(({id,created_at,outputs})=>({id,created_at,outputs}))).get(target)??'V-';
  const detail=await loadProjectEstimateDetail(`proj_${project}`,`est_${target}`);
  expect(detail).toMatchObject({id:`est_${target}`,projectId:`proj_${project}`,versionLabel:expected,internalNotes:'retained',summary:{total:123},editability:emptyEstimateEditability()});
  expect(detail!.calculatorSnapshot!.outputs).toEqual(targetRow!.outputs);
  expect(labelSelection).toBe('id, created_at, version:outputs->version');
  expect(requests).toEqual([{table:'estimates',fields:'*',filters:[['id',target],['project_id',project]],order:undefined},
    {table:'estimates',fields:labelSelection,filters:[['project_id',project]],order:{field:'created_at',options:{ascending:false}}}]);
  expect(mocks.flow).toHaveBeenCalledExactlyOnceWith(project,undefined,client);
});
it('preserves missing-target and label-read failure behavior',async()=>{
  targetRow=null;expect(await loadProjectEstimateDetail(`proj_${project}`,`est_${target}`)).toBeNull();expect(mocks.flow).not.toHaveBeenCalled();
  targetRow={id:target,project_id:project};labelFailure=Error('caller-bound read failed');
  await expect(loadProjectEstimateDetail(`proj_${project}`,`est_${target}`)).rejects.toThrow('caller-bound read failed');
});
