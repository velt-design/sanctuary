import { dispatchRequest } from '@/lib/emailReview/dispatch/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{batchId:string}>};
export async function GET(request:Request,context:Context){return dispatchRequest(request,(await context.params).batchId,'read');}
export async function POST(request:Request,context:Context){return dispatchRequest(request,(await context.params).batchId,'prepare');}
