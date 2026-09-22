import { dispatchRequest } from '@/lib/emailReview/dispatch/server';
import { reviewJson } from '@/lib/emailReview/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{batchId:string;action:string}>};
export async function POST(request:Request,context:Context){
  const {batchId,action}=await context.params;
  if(action!=='claim'&&action!=='result'&&action!=='cancel')return reviewJson({error:'Action unavailable'},404);
  return dispatchRequest(request,batchId,action);
}
