import { workdeskFileResponse } from '../../workdeskFilesFixture';
export async function GET(request:Request,{params}:{params:Promise<{fileId:string}>}) {
  if(process.env.ENABLE_PORTAL_QA_FIXTURES?.trim()!=='1')return new Response(null,{status:404});
  const {fileId}=await params;
  return workdeskFileResponse(fileId,new URL(request.url).searchParams.get('download')==='1');
}
