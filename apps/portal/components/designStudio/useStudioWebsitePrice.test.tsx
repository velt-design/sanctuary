import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {useStudioWebsitePrice} from './useStudioWebsitePrice';
import {newStudioWebsiteDesign} from '@/lib/designStudio/websiteDesign';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
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
