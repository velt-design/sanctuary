import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireStaffContext} from '@/lib/api/staffApi';
import {studioIdentifier} from '@/lib/designStudio/identifiers';
import StudioNewDesign from '@/components/designStudio/StudioNewDesign';
import css from '@/components/designStudio/StudioWebsite.module.css';
export const dynamic='force-dynamic';
export default async function StudioProjectPage({params}:{params:Promise<{projectId:string}>}){if(process.env.ENABLE_PORTAL_DESIGN_STUDIO!=='1')notFound();const {projectId}=await params,project=studioIdentifier(projectId,'proj'),auth=await requireStaffContext();if(!auth.ok||!['staff','admin'].includes(auth.session.role))notFound();const visible=await auth.supabase.from('projects').select('id,name').eq('id',project.uuid).maybeSingle();if(!visible.data)notFound();const result=await auth.supabase.from('estimates').select('id,version,internal_name,status,outputs,created_at').eq('project_id',project.uuid).order('created_at',{ascending:false});
 const designs=(result.data??[]).filter(row=>row.outputs?.studio_authored).map(row=>({id:studioIdentifier(row.id,'est').appId,label:row.internal_name||`Design ${row.version}`,status:row.status}));
 return <main className={`${css.page} ${css.review}`}><header className={css.header}><div><Link className={css.back} href={`/staff/projects/${project.appId}`}>Back to Project</Link><h1>Design Studio</h1><p>{visible.data.name}</p></div></header><StudioNewDesign embedded projectId={project.appId}/><section><h2>Saved designs</h2>{result.error?<p role="alert">Saved designs could not be loaded. Reload to retry.</p>:designs.length?designs.map(d=><p key={d.id}><Link href={`/staff/design-studio/${project.appId}/${d.id}${d.status==='draft'?'/edit':''}`}>{d.label}</Link> · {d.status} · <Link href={`/staff/design-studio/${project.appId}/${d.id}`}>Review</Link></p>):<p>Create your first design for this project.</p>}</section></main>;
}
