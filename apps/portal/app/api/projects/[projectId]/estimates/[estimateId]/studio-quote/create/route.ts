import {createStudioClientQuoteRequest} from '@/lib/designStudio/atomicQuoteCreate.server';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{projectId:string;estimateId:string}>}){
 return createStudioClientQuoteRequest(request,await context.params);
}
