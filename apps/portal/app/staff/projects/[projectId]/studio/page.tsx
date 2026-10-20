import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireStaffContext} from '@/lib/api/staffApi';
import {studioIdentifier} from '@/lib/designStudio/identifiers';
import {loadStudioProject} from '@/lib/queries/studioProject.server';
import StudioNewDesign from '@/components/designStudio/StudioNewDesign';
import css from '@/components/designStudio/StudioWebsite.module.css';
export const dynamic='force-dynamic';
export default async function StudioProjectPage({params}:{params:Promise<{projectId:string}>}){if(process.env.ENABLE_PORTAL_DESIGN_STUDIO!=='1')notFound();const {projectId}=await params,project=studioIdentifier(projectId,'proj'),auth=await requireStaffContext();if(!auth.ok||!['staff','admin'].includes(auth.session.role))notFound();const saved=await loadStudioProject(auth.supabase,project.uuid);if(!saved)notFound();const {designs}=saved;
 return <main className={`${css.page} ${css.review}`}><header className={css.header}><div><Link className={css.back} href={`/staff/projects/${project.appId}`}>Back to Project</Link><h1>Design Studio</h1><p>{saved.project.name}</p></div></header><StudioNewDesign embedded projectId={project.appId}/><section><h2>Saved designs</h2>{saved.loadError?<p role="alert">Saved designs could not be loaded. Reload to retry.</p>:designs.length?designs.map(d=><p key={d.id}><Link href={`/staff/design-studio/${project.appId}/${d.id}${d.status==='draft'?'/edit':''}`}>{d.label}</Link> · {d.status} · <Link href={`/staff/design-studio/${project.appId}/${d.id}`}>Review</Link></p>):<p>Create your first design for this project.</p>}</section></main>;
}
