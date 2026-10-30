import {studioClientDocumentRequest} from '@/lib/designStudio/clientDocumentRequest.server';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{quoteVersionId:string}>}){const response=await studioClientDocumentRequest(request,(await context.params).quoteVersionId);response.headers.set('Cache-Control','private, no-store');return response;}
export const POST=GET;
