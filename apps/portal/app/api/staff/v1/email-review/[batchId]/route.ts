import { readReview } from '@/lib/emailReview/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{batchId:string}>}) {return readReview(request,await context.params);}
