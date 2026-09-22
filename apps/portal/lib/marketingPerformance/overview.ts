import { aucklandDay } from './contract';
import type { HubProject, HubEvent } from './hub';

export const ageBands = [
  {key:'0-7',label:'0–7 days',min:0,max:7},
  {key:'8-30',label:'8–30 days',min:8,max:30},
  {key:'31-90',label:'31–90 days',min:31,max:90},
  {key:'91+',label:'91+ days',min:91,max:Infinity},
  {key:'unknown',label:'Date needs review',min:-Infinity,max:-1},
] as const;
export function projectAge(p:HubProject,asOf:string) {
  return Math.round((Date.parse(aucklandDay(new Date(asOf)))-Date.parse(aucklandDay(new Date(p.createdAt))))/86400000);
}
export function matchesAge(p:HubProject,asOf:string,key:string) {
  const band=ageBands.find(b=>b.key===key), days=projectAge(p,asOf);
  return Boolean(band && ['ACTIVE','WAITING'].includes(p.state) && days>=band.min && days<=band.max);
}
export function ageDistribution(projects:HubProject[],asOf:string) {
  return ageBands.map(b=>({...b,count:projects.filter(p=>matchesAge(p,asOf,b.key)).length}));
}
export function monthlyActivity(events:HubEvent[],start:string,end:string) {
  const rows=[];
  for(let month=start.slice(0,7);month<=end.slice(0,7);){
    const first=`${month}-01`, next=new Date(`${first}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth()+1);
    const last=new Date(next.getTime()-86400000).toISOString().slice(0,10);
    const from=first<start?start:first, to=last>end?end:last;
    const entries=events.filter(e=>e.day>=from&&e.day<=to);
    const receipts=entries.filter(e=>e.kind==='payment'||e.kind==='reversal');
    const missing=receipts.filter(e=>e.amountCents===null).length;
    rows.push({month,start:from,end:to,partial:from!==first||to!==last,
      sent:entries.filter(e=>e.kind==='quote_sent').length,
      accepted:entries.filter(e=>e.kind==='quote_accepted').length,
      receiptEntries:receipts.length,missing,
      receipts:missing?null:receipts.reduce((sum,e)=>sum+e.amountCents!,0)/100});
    month=next.toISOString().slice(0,7);
  }
  return rows;
}
