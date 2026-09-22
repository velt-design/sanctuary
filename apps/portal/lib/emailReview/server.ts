import 'server-only';
import { NextResponse } from 'next/server';
import { requireStaffContext } from '@/lib/api/staffApi';
import { requireAdminContext } from '@/lib/api/adminApi';
import { EmailReviewInputError, parseReviewCommand, parseReviewImport, reviewUuid } from './validation';

export function reviewJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff' } });
}
function errorResponse(error: { code?: string } | null) {
  const status=error?.code==='42501'?403:error?.code==='PT404'?404:['PT409','40001','23505'].includes(error?.code??'')?409:
    ['22023','22P02','23514','23502','23503'].includes(error?.code??'')?400:503;
  return reviewJson({error:status===409?'This record changed. Reload and review it again.':status===403?'Access denied':status===404?'Review item unavailable':status===400?'Invalid review request':'Review service unavailable',
    code:status===409?'REVIEW_CONFLICT':status===503?'REVIEW_UNAVAILABLE':'REVIEW_REQUEST_REJECTED'},status);
}
/** Stream limit remains effective without Content-Length. Never log imported correspondence. */
export async function reviewBody(request: Request, limit: number): Promise<unknown> {
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!request.body) throw new EmailReviewInputError();
  const reader=request.body.getReader(); const chunks:Uint8Array[]=[];let size=0;
  try { for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new EmailReviewInputError();}chunks.push(value);}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  } catch { throw new EmailReviewInputError(); } finally { reader.releaseLock(); }
}
export function reviewSameOrigin(request: Request) {
  // Next can rewrite request.url to an internal host; pin the public origin.
  try {
    const configured=process.env.EMAIL_REVIEW_ORIGIN;
    if(!configured)return false;
    const url=new URL(configured);
    const loopback=process.env.NODE_ENV!=='production' && url.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
    if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!loopback))return false;
    return request.headers.get('origin')===url.origin;
  } catch { return false; }
}
type Target = {batchId?:string;itemId?:string};
export async function readReview(request: Request, target: Target = {}) {
  const auth=await requireStaffContext();if(!auth.ok)return auth.response;
  try { const q=new URL(request.url).searchParams; const page=Number(q.get('page')??1),limit=Number(q.get('limit')??50),status=q.get('status')??'all',query=q.get('q')??'';
    if(!Number.isInteger(page)||page<1||page>10000||!Number.isInteger(limit)||limit<1||limit>100||!['all','draft','approved','skipped'].includes(status)||query.length>200)throw new EmailReviewInputError();
    const {data,error}=await auth.supabase.rpc('email_review_read',{p_batch_id:target.batchId?reviewUuid(target.batchId):null,p_item_id:target.itemId?reviewUuid(target.itemId):null,p_page:page,p_limit:limit,p_status:status,p_query:query});
    return error?errorResponse(error):reviewJson(data);
  } catch(e){return e instanceof EmailReviewInputError?errorResponse({code:'22023'}):errorResponse(null);}
}
export async function mutateReview(request: Request, target?: Target) {
  if(!reviewSameOrigin(request))return errorResponse({code:'42501'});
  const auth=target?await requireStaffContext():await requireAdminContext();if(!auth.ok)return auth.response;
  try { const input=await reviewBody(request,target?65536:2097152);
    const {data,error}=target?await auth.supabase.rpc('email_review_command',{p_batch_id:reviewUuid(target.batchId),p_item_id:reviewUuid(target.itemId),p_input:parseReviewCommand(input)}):
      await auth.supabase.rpc('email_review_import',{p_input:parseReviewImport(input)});
    return error?errorResponse(error):reviewJson(data,target?200:201);
  } catch(e){return e instanceof EmailReviewInputError?errorResponse({code:'22023'}):errorResponse(null);}
}
export async function readReviewers() {
  const auth=await requireAdminContext();if(!auth.ok)return auth.response;
  try { const {data,error}=await auth.supabase.rpc('email_review_reviewers');return error?errorResponse(error):reviewJson(data); }
  catch{return errorResponse(null);}
}
