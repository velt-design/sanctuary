import { readReview,mutateReview } from '@/lib/emailReview/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{batchId:string;itemId:string}>};
export async function GET(request:Request,context:Context) {return readReview(request,await context.params);}
export async function PATCH(request:Request,context:Context) {return mutateReview(request,await context.params);}
