import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {useStudioWebsitePrice} from './useStudioWebsitePrice';
import {newStudioWebsiteDesign} from '@/lib/designStudio/websiteDesign';
import {studioAttachmentFixture} from '../../../../test/studioAttachmentFixture';
import {studioOpeningPrice,studioWebsitePricePayload} from '@/lib/designStudio/studioOpening';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('waits for canonical input readiness before rejecting a transient null opening composition',async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const design=newStudioWebsiteDesign('p'),payload=studioWebsitePricePayload({designId:'d',revision:1,design}),cancel=vi.fn();let complete!:(value:any)=>void;
 const opening=studioOpeningPrice({actorId:'a',role:'staff',projectId:'p',estimateId:'e',designId:'d',revision:1,requestKey:payload.requestKey},new Promise(resolve=>{complete=resolve;}),cancel),fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 function Harness({ready=false}:{ready?:boolean}){const result=useStudioWebsitePrice({actorId:'a',projectId:'p',estimateId:'e',designId:'d',revision:1,design:ready?design:null,openingPrice:opening,openingState:ready?'eligible':'waiting'});return <span>{result.price?.amount??'pending'}</span>;}
 const container=document.createElement('div'),root=createRoot(container);
 try{await React.act(async()=>root.render(<Harness/>));await React.act(async()=>vi.advanceTimersByTimeAsync(220));expect(cancel).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();await React.act(async()=>root.render(<Harness ready/>));await React.act(async()=>complete({ok:true,price:{status:'priced',amount:33,requestKey:payload.requestKey}}));expect(container.textContent).toBe('33');expect(fetcher).not.toHaveBeenCalled();}finally{await React.act(async()=>root.unmount());}
});
it.each(['edit','invalid','dirty','retry','revision','actor'])('consumes the exact clean initial tail once, then uses fresh POST after %s',async change=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const composition=studioAttachmentFixture(),payload=studioWebsitePricePayload({designId:'d',revision:1,composition,design:null}),cancel=vi.fn();
 let complete!:(value:any)=>void;
 const opening=studioOpeningPrice({actorId:'a',role:'staff',projectId:'p',estimateId:'e',designId:'d',revision:1,requestKey:payload.requestKey},new Promise(resolve=>{complete=resolve;}),cancel);
 const requests:any[]=[];vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{const body=JSON.parse(init.body);requests.push(body);return{ok:true,json:async()=>({requestKey:body.requestKey,status:'priced',amount:22})};}));
 let result!:ReturnType<typeof useStudioWebsitePrice>,props={composition:composition as typeof composition|null,actor:'a',revision:1,openingState:'waiting' as 'waiting'|'eligible'|'ineligible'};
 function Harness(){result=useStudioWebsitePrice({actorId:props.actor,projectId:'p',estimateId:'e',designId:'d',revision:props.revision,composition:props.composition,design:null,openingPrice:opening,openingState:props.openingState});return <span>{result.error?'error':result.price?.amount??'pending'}</span>;}
 const container=document.createElement('div'),root=createRoot(container),render=async()=>{await React.act(async()=>root.render(<React.StrictMode><Harness/></React.StrictMode>));};
 const tick=async()=>{await React.act(async()=>vi.advanceTimersByTimeAsync(220));};
 try{
  await render();await tick();expect(requests).toHaveLength(0);props.openingState='eligible';await render();await tick();expect(requests).toHaveLength(0);
  await React.act(async()=>complete({ok:true,price:{status:'priced',amount:11,requestKey:payload.requestKey}}));expect(container.textContent).toBe('11');
  if(change==='edit')props.composition={...composition,site:{...composition.site,retainedRaw:'changed'}};
  if(change==='invalid')props.composition=null;
  if(change==='dirty')props.openingState='ineligible';
  if(change==='retry')await React.act(async()=>result.retry());
  if(change==='revision')props.revision=2;
  if(change==='actor')props.actor='b';
  await render();expect(container.textContent).toBe('pending');await tick();
  if(change==='invalid'){expect(requests).toHaveLength(0);props.composition=composition;await render();await tick();}
  expect(cancel).toHaveBeenCalled();expect(requests).toHaveLength(1);expect(container.textContent).toBe('22');
  if(change==='edit'){props.composition=composition;await render();await tick();expect(requests).toHaveLength(2);expect(container.textContent).toBe('22');}
 }finally{await React.act(async()=>root.unmount());}
});

it('keeps geometry-owner readiness independent from a failed tail and retries through a fresh POST',async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const design=newStudioWebsiteDesign('p'),payload=studioWebsitePricePayload({designId:'d',revision:1,design}),cancel=vi.fn();
 const opening=studioOpeningPrice({actorId:'a',role:'staff',projectId:'p',estimateId:'e',designId:'d',revision:1,requestKey:payload.requestKey},Promise.resolve({ok:false,error:'initial unavailable'}),cancel);
 const fetcher=vi.fn(async(_url,init)=>({ok:true,json:async()=>({status:'priced',amount:44,requestKey:JSON.parse(init.body).requestKey})}));vi.stubGlobal('fetch',fetcher);
 let result!:ReturnType<typeof useStudioWebsitePrice>;function Harness(){result=useStudioWebsitePrice({actorId:'a',projectId:'p',estimateId:'e',designId:'d',revision:1,design,openingPrice:opening,openingState:'eligible'});return <span>{result.error??result.price?.amount??'pending'}</span>;}
 const container=document.createElement('div'),root=createRoot(container);
 try{await React.act(async()=>root.render(<Harness/>));expect(container.textContent).toBe('initial unavailable');expect(fetcher).not.toHaveBeenCalled();await React.act(async()=>result.retry());await React.act(async()=>vi.advanceTimersByTimeAsync(0));expect(container.textContent).toBe('44');expect(fetcher).toHaveBeenCalledTimes(1);expect(cancel).toHaveBeenCalled();}finally{await React.act(async()=>root.unmount());}
});
it('immediately hides old price and rejects late replies across edits, actors and estimates',async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const replies:Array<(v:unknown)=>void>=[],keys:string[]=[];
 vi.stubGlobal('fetch',vi.fn((_url,init)=>{keys.push(JSON.parse(init.body).requestKey);return new Promise(resolve=>replies.push(resolve));}));
 const container=document.createElement('div'),root=createRoot(container);
 function Harness({actor='a',estimate='e',width='6000',invalid=false}:{actor?:string;estimate?:string;width?:string;invalid?:boolean}){const design=newStudioWebsiteDesign('p');design.rawDimensions.widthMm=width;const {price,error}=useStudioWebsitePrice({actorId:actor,projectId:'p',estimateId:estimate,designId:'d',revision:1,design:invalid?null:design});return <span>{error?'error':price?.amount??'pending'}</span>;}
 const render=async(props:React.ComponentProps<typeof Harness>)=>{await React.act(async()=>root.render(<Harness {...props}/>));};
 const tick=async()=>{await React.act(async()=>vi.advanceTimersByTimeAsync(220));};
 const reply=async(index:number,amount:number,key=keys[index])=>{await React.act(async()=>replies[index]({ok:true,json:async()=>({status:'priced',amount,requestKey:key})}));};
 try{await render({});await tick();await reply(0,10);expect(container.textContent).toBe('10');await render({width:'4825'});expect(container.textContent).toBe('pending');await tick();await render({actor:'b',estimate:'e2'});await tick();await reply(2,30);await reply(1,20);expect(container.textContent).toBe('30');await render({invalid:true});expect(container.textContent).toBe('pending');await render({width:'5000'});await tick();await reply(3,50,'wrong');expect(container.textContent).toBe('error');}finally{await React.act(async()=>root.unmount());}
});

it('reuses immutable snapshot keys while raw choices, revision, scope and retry retain fresh-request authority',async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const requests:Array<{url:string;body:any;signal:AbortSignal;reply:(value:unknown)=>void}>=[];
 vi.stubGlobal('fetch',vi.fn((url,init)=>new Promise(resolve=>requests.push({url,body:JSON.parse(init.body),signal:init.signal,reply:resolve}))));
 const container=document.createElement('div'),root=createRoot(container);
 let result!:ReturnType<typeof useStudioWebsitePrice>;
 function Harness({composition,actor='a',project='p',estimate='e',revision=1}:{composition:ReturnType<typeof studioAttachmentFixture>;actor?:string;project?:string;estimate?:string;revision?:number}){
  result=useStudioWebsitePrice({actorId:actor,projectId:project,estimateId:estimate,designId:'d',revision,design:null,composition});
  return <span>{result.error?'error':result.price?.amount??'pending'}</span>;
 }
 let props:React.ComponentProps<typeof Harness>={composition:studioAttachmentFixture()};
 const render=async(patch:Partial<typeof props>={})=>{props={...props,...patch};await React.act(async()=>root.render(<Harness {...props}/>));};
 const tick=async()=>{await React.act(async()=>vi.advanceTimersByTimeAsync(220));};
 const reply=async(index:number,amount:number)=>{await React.act(async()=>requests[index].reply({ok:true,json:async()=>({status:'priced',amount,requestKey:requests[index].body.requestKey})}));};
 try {
  await render();await tick();await reply(0,10);
  await render();await render({composition:structuredClone(props.composition)});await tick();
  expect(requests).toHaveLength(1);expect(container.textContent).toBe('10');
  const raw=structuredClone(props.composition);raw.site.retainedRaw='0.00';
  await render({composition:raw});expect(container.textContent).toBe('pending');await tick();
  expect(requests[1].body.composition.site.retainedRaw).toBe('0.00');
  const option=structuredClone(raw);option.objectOptions[0].values.retainedRaw='';
  await render({composition:option});await tick();
  expect(requests[1].signal.aborted).toBe(true);expect(requests[2].body.composition.objectOptions[0].values).toHaveProperty('retainedRaw','');
  await reply(1,99);expect(container.textContent).toBe('pending');await reply(2,20);expect(container.textContent).toBe('20');
  await render({revision:2});await tick();expect(requests[3].body.revision).toBe(2);expect(requests[3].body.requestKey).not.toBe(requests[2].body.requestKey);
  await render({actor:'b',project:'p2',estimate:'e2'});await tick();
  expect(requests[3].signal.aborted).toBe(true);expect(requests[4].url).toContain('/projects/p2/estimates/e2/');
  await reply(3,88);expect(container.textContent).toBe('pending');await reply(4,30);
  await React.act(async()=>result.retry());expect(container.textContent).toBe('pending');await tick();
  expect(requests).toHaveLength(6);expect(requests[5].body.requestKey).toBe(requests[4].body.requestKey);await reply(5,31);expect(container.textContent).toBe('31');
  await render({actor:''});await tick();expect(requests).toHaveLength(6);expect(container.textContent).toBe('pending');
 } finally {await React.act(async()=>root.unmount());}
});


it('starts the first eligible scope and explicit Retry on the next turn while coalescing later authoring and revision changes', async () => {
 vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
 const requests: Array<{body:any;signal:AbortSignal;reply:(value:unknown)=>void}> = [];
 vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise(resolve => requests.push({body:JSON.parse(init.body),signal:init.signal,reply:resolve}))));
 const container=document.createElement('div'),root=createRoot(container);let result!:ReturnType<typeof useStudioWebsitePrice>;
 function Harness({invalid=false,width='6000',revision=1}:{invalid?:boolean;width?:string;revision?:number}){const design=newStudioWebsiteDesign('p');design.rawDimensions.widthMm=width;result=useStudioWebsitePrice({actorId:'a',projectId:'p',estimateId:'e',designId:'d',revision,design:invalid?null:design});return <span>{result.error?'error':result.price?.amount??'pending'}</span>;}
 const render=async(props:React.ComponentProps<typeof Harness>)=>{await React.act(async()=>root.render(<Harness {...props}/>));};
 const tick=async(ms:number)=>{await React.act(async()=>vi.advanceTimersByTimeAsync(ms));};
 const reply=async(index:number,amount:number,key=requests[index].body.requestKey)=>{await React.act(async()=>requests[index].reply({ok:true,json:async()=>({amount,status:'priced',requestKey:key})}));};
 try {
  await render({invalid:true});await tick(220);expect(requests).toHaveLength(0);
  await render({});expect(requests).toHaveLength(0);await tick(0);expect(requests).toHaveLength(1);
  await reply(0,10);expect(container.textContent).toBe('10');
  await render({width:'6100'});await tick(0);expect(requests).toHaveLength(1);await tick(100);
  await render({width:'6200'});await tick(219);expect(requests).toHaveLength(1);await tick(1);expect(requests).toHaveLength(2);
  expect(requests[1].body.design.rawDimensions.widthMm).toBe('6200');await reply(1,20);
  await React.act(async()=>result.retry());expect(container.textContent).toBe('pending');expect(requests).toHaveLength(2);await tick(0);expect(requests).toHaveLength(3);
  expect(requests[2].body.requestKey).toBe(requests[1].body.requestKey);await reply(2,21);
  await render({width:'6200',revision:2});await tick(0);expect(requests).toHaveLength(3);await tick(220);expect(requests).toHaveLength(4);
  expect(requests[3].body.revision).toBe(2);
 } finally {await React.act(async()=>root.unmount());}
});

it.each([{actor:'b'},{project:'p2'},{estimate:'e2'},{designId:'d2'}])('keeps immediate scope requests fenced across %j, wrong keys, abortion and unmount', async patch => {
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const requests:Array<{url:string;body:any;signal:AbortSignal;reply:(value:unknown)=>void}>=[];
 vi.stubGlobal('fetch',vi.fn((url,init)=>new Promise(resolve=>requests.push({url,body:JSON.parse(init.body),signal:init.signal,reply:resolve}))));
 const container=document.createElement('div'),root=createRoot(container);let result!:ReturnType<typeof useStudioWebsitePrice>;
 function Harness({actor='a',project='p',estimate='e',designId='d'}:{actor?:string;project?:string;estimate?:string;designId?:string}){result=useStudioWebsitePrice({actorId:actor,projectId:project,estimateId:estimate,designId,revision:1,design:newStudioWebsiteDesign(designId+':p')});return <span>{result.error?'error':result.price?.amount??'pending'}</span>;}
 const render=async(props:React.ComponentProps<typeof Harness>)=>{await React.act(async()=>root.render(<Harness {...props}/>));};
 const tick=async()=>{await React.act(async()=>vi.advanceTimersByTimeAsync(0));};
 const reply=async(index:number,amount:number,key=requests[index].body.requestKey)=>{await React.act(async()=>requests[index].reply({ok:true,json:async()=>({amount,status:'priced',requestKey:key})}));};
 try {
  await render({});await tick();expect(requests).toHaveLength(1);
  const next={actor:'a',project:'p',estimate:'e',designId:'d',...patch};
  await render(next);expect(requests[0].signal.aborted).toBe(true);await tick();expect(requests).toHaveLength(2);
  expect(requests[1].url).toContain('/projects/'+next.project+'/estimates/'+next.estimate+'/');expect(requests[1].body.designId).toBe(next.designId);
  await reply(1,22);await reply(0,99);expect(container.textContent).toBe('22');
  await React.act(async()=>result.retry());await tick();expect(requests).toHaveLength(3);await reply(2,33,'wrong-key');expect(container.textContent).toBe('error');
  await render({actor:'c'});expect(container.textContent).toBe('pending');
 } finally {await React.act(async()=>root.unmount());}
 await tick();expect(requests).toHaveLength(3);expect(requests[2].signal.aborted).toBe(true);
});

it('does not consume the first eligible async turn during StrictMode effect cleanup',async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const request=vi.fn(()=>new Promise(()=>{}));vi.stubGlobal('fetch',request);
 const container=document.createElement('div'),root=createRoot(container);
 function Harness(){useStudioWebsitePrice({actorId:'a',projectId:'p',estimateId:'e',designId:'d',revision:1,design:newStudioWebsiteDesign('p')});return null;}
 try {await React.act(async()=>root.render(<React.StrictMode><Harness/></React.StrictMode>));expect(request).not.toHaveBeenCalled();await React.act(async()=>vi.advanceTimersByTimeAsync(0));expect(request).toHaveBeenCalledTimes(1);}
 finally {await React.act(async()=>root.unmount());}
});


it('keeps a denied initial price unavailable and retries immediately without optimistic success',async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const replies:Array<(value:unknown)=>void>=[];vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>replies.push(resolve))));
 const container=document.createElement('div'),root=createRoot(container);let result!:ReturnType<typeof useStudioWebsitePrice>;
 function Harness(){result=useStudioWebsitePrice({actorId:'a',projectId:'p',estimateId:'e',designId:'d',revision:1,design:newStudioWebsiteDesign('p')});return <span>{result.error??result.price?.amount??'pending'}</span>;}
 try {
  await React.act(async()=>root.render(<Harness/>));await React.act(async()=>vi.advanceTimersByTimeAsync(0));expect(replies).toHaveLength(1);
  await React.act(async()=>replies[0]({ok:false,json:async()=>({error:'Create a new revision before calculating changed design choices.'})}));
  expect(result.price).toBeNull();expect(container.textContent).toContain('Create a new revision');
  await React.act(async()=>result.retry());expect(container.textContent).toBe('pending');expect(result.price).toBeNull();await React.act(async()=>vi.advanceTimersByTimeAsync(0));expect(replies).toHaveLength(2);
  await React.act(async()=>replies[1]({ok:false,json:async()=>({error:'Staff access is required'})}));expect(result.price).toBeNull();expect(container.textContent).toBe('Staff access is required');
 } finally {await React.act(async()=>root.unmount());}
});
