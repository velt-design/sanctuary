import { z } from 'zod';
import { requireStaffContext,jsonError,jsonOk } from '@/lib/api/staffApi';
import { isDeveloper } from '@/lib/developerAccess';
import { calendarSameOrigin } from '@/lib/siteVisits/http';
import { salesDesignerSchema,salesDesignerCommandSchema } from '@/lib/marketingPerformance/salesDesigner';
export const runtime='nodejs';
type Context={params:Promise<{projectId:string}>};
const reply=(response:Response)=>{response.headers.set('Cache-Control','private, no-store');return response;};
async function handle(request:Request,context:Context,write:boolean){
  const staff=await requireStaffContext();
  if(!staff.ok)return reply(staff.response);
  if(!isDeveloper(staff.session.user))return reply(jsonError('Owner access is required.',403));
  const {projectId}=await context.params;
  if(!z.string().uuid().safeParse(projectId).success)return reply(jsonError('Invalid project.',400));
  try{
    let command;
    if(write){
      if(!calendarSameOrigin(request))return reply(jsonError('Same-origin request required.',403));
      if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return reply(jsonError('JSON request required.',415));
      const text=await request.text();if(text.length>3000)return reply(jsonError('Assignment request is too large.',413));
      try{command=salesDesignerCommandSchema.parse(JSON.parse(text));}catch{return reply(jsonError('Provide a designer and a short reason for this assignment.',400));}
    }
    const {data,error}=command?await staff.supabase.rpc('project_sales_designer_assign',{p_project:projectId,p_command:command.commandId,
      p_expected_revision:command.expectedRevision,p_designer:command.designerKey,p_basis:command.basis}):await staff.supabase.rpc('project_sales_designer_read',{p_project:projectId});
    if(error){const status=error.code==='42501'?403:error.code==='40001'?409:error.code==='P0002'?404:error.code==='22023'?400:503;
      return reply(jsonError(status===409?'This assignment changed or the command was already used. Reload it before saving.':status===403?'Owner access is required.':status===404?'Project unavailable.':'Sales designer assignment could not be verified.',status));}
    const value=salesDesignerSchema.safeParse(data);
    if(!value.success||value.data.projectId!==projectId)return reply(jsonError('Sales designer assignment could not be verified.',503));
    return reply(jsonOk({assignment:value.data}));
  }catch{return reply(jsonError('Sales designer assignment could not be verified. Retry the same request.',503));}
}
export const GET=(request:Request,context:Context)=>handle(request,context,false);
export const PUT=(request:Request,context:Context)=>handle(request,context,true);
