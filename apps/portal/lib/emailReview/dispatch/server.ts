import 'server-only';
import { requireAdminContext } from '@/lib/api/adminApi';
import { reviewBody, reviewJson, reviewSameOrigin } from '../server';
import { EmailReviewInputError, reviewUuid } from '../validation';
import { parseDispatchClaim, parseDispatchPrepare, parseDispatchResult } from './validation';

export async function dispatchRequest(request:Request,batchId:string,action:'read'|'prepare'|'claim'|'result'|'cancel') {
  if(action!=='read'&&!reviewSameOrigin(request))return reviewJson({error:'Access denied'},403);
  const auth=await requireAdminContext();if(!auth.ok)return auth.response;
  try {
    const raw=action==='read'?{}:await reviewBody(request,16384);
    const input=action==='read'?{}:action==='claim'?parseDispatchClaim(raw):action==='result'?parseDispatchResult(raw):parseDispatchPrepare(raw);
    const {data,error}=await auth.supabase.rpc('email_review_dispatch',{p_batch_id:reviewUuid(batchId),p_action:action,p_input:input});
    if(error){
      const status=error.code==='42501'?403:error.code==='PT404'?404:['PT409','23505','40001'].includes(error.code)?409:['22023','22P02','23514'].includes(error.code)?400:503;
      return reviewJson({error:status===409?'The batch changed or review is incomplete. Reload before continuing.':status===400?'Invalid dispatch request':status===403?'Access denied':'Dispatch unavailable'},status);
    }
    return reviewJson(data);
  }catch(error){return reviewJson({error:error instanceof EmailReviewInputError?'Invalid dispatch request':'Dispatch unavailable'},error instanceof EmailReviewInputError?400:503);}
}
