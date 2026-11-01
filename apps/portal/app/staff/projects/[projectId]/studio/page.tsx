import {notFound} from 'next/navigation';
import {requireStaffContext} from '@/lib/api/staffApi';
import {studioIdentifier} from '@/lib/designStudio/identifiers';
import {loadStudioProject} from '@/lib/queries/studioProject.server';
import StudioProjectEntry from '@/components/designStudio/StudioProjectEntry';
export const dynamic='force-dynamic';
export default async function StudioProjectPage({params,searchParams}:{params:Promise<{projectId:string}>;searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 if(process.env.ENABLE_PORTAL_DESIGN_STUDIO!=='1')notFound();
 const {projectId}=await params,project=studioIdentifier(projectId,'proj'),auth=await requireStaffContext();
 if(!auth.ok||!['staff','admin'].includes(auth.session.role))notFound();
 const saved=await loadStudioProject(auth.supabase,project.uuid);if(!saved)notFound();
 const query=await searchParams,mode=query?.new==='option'?'option':query?.new==='add-on'?'add-on':'current';
 let creationRequestId:string|undefined;
 if(mode!=='current') { try { if(typeof query?.requestId!=='string')notFound();creationRequestId=studioIdentifier(query.requestId,'est').uuid; } catch { notFound(); } }
 return <StudioProjectEntry projectId={project.appId} actorId={auth.session.user.id} initial={saved} mode={mode} creationRequestId={creationRequestId}/>;
}
