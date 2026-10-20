import { apiJson } from '@/lib/repo/apiClient';

const requestLimitMs = 20_000;
class VisitRequestTimeout extends Error {
  constructor() { super('The request took too long.'); }
}

// Aborting stops our wait, not necessarily the server transaction. Ignore late
// settlement and leave reconciliation to the editor before another command.
export function visitRequest<T>(path:string,init:RequestInit={}):Promise<T> {
  const controller=new AbortController();
  return new Promise<T>((resolve,reject)=>{
    const timer=setTimeout(()=>{reject(new VisitRequestTimeout());controller.abort();},requestLimitMs);
    apiJson<T>(path,{...init,signal:controller.signal}).then(resolve,reject).finally(()=>clearTimeout(timer));
  });
}
