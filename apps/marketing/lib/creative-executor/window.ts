const zone = 'Pacific/Auckland';
function parts(seconds: number) {
 const fields = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(new Date(seconds*1000));
 return Object.fromEntries(fields.map(part=>[part.type,part.value]));
}
export function nativeWindowValid(start:number,end:number) {
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<=0||end<=start)return false;
 const a=parts(start),b=parts(end);
 return [a,b].every(p=>p.hour==='00'&&p.minute==='00'&&p.second==='00')
  && Date.parse(`${b.year}-${b.month}-${b.day}T00:00:00Z`)-Date.parse(`${a.year}-${a.month}-${a.day}T00:00:00Z`)===14*86400000;
}
export function aucklandMidnight(day:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Invalid campaign day');
 const target=Date.parse(`${day}T00:00:00Z`);let candidate=target;
 for(let i=0;i<4;i++){const p=parts(candidate/1000);const represented=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);candidate+=target-represented;}
 if(!Number.isFinite(candidate))throw new Error('Invalid campaign day');return candidate/1000;
}
export function nativeWindow(day:string) {
 const next=new Date(Date.parse(`${day}T00:00:00Z`)+14*86400000).toISOString().slice(0,10);
 return {start:aucklandMidnight(day),end:aucklandMidnight(next)};
}
