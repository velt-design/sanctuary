import 'server-only';
import {applyRouteDiagnostics,createRouteDiagnostics,logPortalServerWarn} from '@/lib/api/routeDiagnostics';

type Stage='guard'|'quote-authority'|'version-metadata'|'project-display'|'theme'|'target'|'projection'|'price-preparation'|'price-calculation';
export type StudioOpeningTerminal='price-response'|'price-error'|'price-timeout'|'request-aborted'|'reader-canceled';
type Outcome=StudioOpeningTerminal|'response'|'failure';
type Entry={stage:Stage;started:number;durationMs?:number;state:'pending'|'settled'|'rejected'};

/** Local investigation only. No request payload, identity or exception is a log input. */
export function createStudioRequestDiagnostics(){
 const context=createRouteDiagnostics(null,'/api/projects/[projectId]/estimates/[estimateId]/studio','GET');
 const startedAtUtc=new Date().toISOString();
 const enabled=process.env.STUDIO_REQUEST_DIAGNOSTICS==='1',stages:Entry[]=[];
 let finished=false;
 const start=(stage:Stage)=>{
  if(!enabled||finished||stages.length>=9)return()=>{};
  const entry:Entry={stage,started:performance.now(),state:'pending'};stages.push(entry);
  return(state:'settled'|'rejected'='settled')=>{
   if(finished||entry.state!=='pending')return;
   entry.durationMs=Number((performance.now()-entry.started).toFixed(1));entry.state=state;
  };
 };
 return{
  context,start,
  async measure<T>(stage:Stage,work:()=>T|PromiseLike<T>):Promise<T>{
   const stop=start(stage);
   try{const result=await work();stop();return result;}catch(error){stop('rejected');throw error;}
  },
  apply(response:Response){return applyRouteDiagnostics(response,context);},
  finish(outcome:Outcome,status:number){
   if(finished)return;finished=true;
   if(!enabled)return;
   // Logging is never a data, permission, price or transport dependency.
   try{logPortalServerWarn(context,{
    event:'studio.request_diagnostics',message:'Studio request completed',status,
    extra:{startedAtUtc,outcome,stages:stages.map(({stage,started,durationMs,state})=>({stage,state,startMs:Number((started-context.startedAt).toFixed(1)),durationMs:durationMs??Number((performance.now()-started).toFixed(1))}))},
   });}catch{}
  },
 };
}
export type StudioRequestDiagnostics=ReturnType<typeof createStudioRequestDiagnostics>;
