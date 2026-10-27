'use client';
import {useCallback,useMemo,useRef,useState,type ReactNode,type UIEvent} from 'react';
import {Button} from '@/components/ui/foundation/FoundationControls';
import {Input,Select} from '@/components/ui/foundation/FoundationControls';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/foundation/FoundationSurfaces';
import styles from './overview/ProjectSharePointFilesPanel.module.css';
import ReadStatus from '../ProjectReadFeedback';
import enquiryStyles from './overview/ProjectEnquiryFilesPanel.module.css';
import workspaceStyles from './FilesTab.module.css';
function neutralFilesState(projectId:string) {
 return {projectId,term:'',source:'sharepoint' as 'sharepoint'|'website',edited:false,interacted:false};
}
export function useFilesControls(projectId:string) {
 const current=useRef(projectId);current.current=projectId;
 const [state,setState]=useState(()=>neutralFilesState(projectId));
 const value=state.projectId===projectId?state:neutralFilesState(projectId);
 const setTerm=useCallback((term:string)=>setState(prior=>current.current!==projectId?prior:{...(prior.projectId===projectId?prior:neutralFilesState(projectId)),term,edited:true}),[projectId]);
 const setSource=useCallback((source:'sharepoint'|'website')=>setState(prior=>current.current!==projectId?prior:{...(prior.projectId===projectId?prior:neutralFilesState(projectId)),source,edited:true}),[projectId]);
 const receive=useCallback((term:string,source:'sharepoint'|'website')=>setState(prior=>current.current!==projectId||prior.projectId===projectId&&prior.term===term&&prior.source===source?prior:{...(prior.projectId===projectId?prior:neutralFilesState(projectId)),term,source}),[projectId]);
 const interact=useCallback(()=>setState(prior=>current.current!==projectId||prior.projectId===projectId&&prior.interacted?prior:{...(prior.projectId===projectId?prior:neutralFilesState(projectId)),interacted:true}),[projectId]);
 const panelRef=useRef<HTMLElement>(null),listRef=useRef<HTMLDivElement>(null);
 return useMemo(()=>({...value,setTerm,setSource,receive,interact,panelRef,listRef}),[value.projectId,value.term,value.source,value.edited,value.interacted,setTerm,setSource,receive,interact]);
}
export type FilesControls=ReturnType<typeof useFilesControls>;
export type ProjectFilesEvidence={metadata:ReactNode;rootControls:ReactNode;rail:ReactNode;breadcrumbs:ReactNode;back:ReactNode;status:ReactNode;statusTitle?:string;pending?:boolean;retry?:()=>void;finding:ReactNode;rows:ReactNode;empty:ReactNode;paging:ReactNode;preview:ReactNode;website:ReactNode;
 find:(term:string)=>void;selectSource:(source:'sharepoint'|'website')=>void;onScroll:(event:UIEvent<HTMLDivElement>)=>void;takeControl:()=>void};
export type FilesBinding={controls:FilesControls;publish:(value:ProjectFilesEvidence|null)=>void};
export function ProjectFilesSurface({controls,evidence,workspace=false,unavailable=false}:{controls:FilesControls;evidence:ProjectFilesEvidence|null;workspace?:boolean;unavailable?:boolean}) {
 const find=(term:string)=>{controls.setTerm(term);evidence?.find(term);};
 const source=(next:'sharepoint'|'website')=>{controls.setSource(next);evidence?.selectSource(next);};
 const takeControl=()=>{controls.interact();evidence?.takeControl();};
 return <section ref={controls.panelRef} className={`${styles.panel} ${workspace?styles.workspace:''}`} aria-label="SharePoint project files">
 <header className={styles.header}><div><h3>Files</h3><p className={styles.metadata}>{evidence?.metadata??(unavailable?'Files unavailable':'Reading project files…')}</p></div><div className={styles.headerControls}>
 {evidence?.rootControls??<><Select aria-label="Project folder" value={controls.source==='website'?'website':''} onChange={event=>source(event.target.value==='website'?'website':'sharepoint')}><option value="">Project folder</option><option value="website">Website enquiry files</option></Select><Button variant="quiet" size="small" disabled>Refresh files</Button></>}<ReadStatus title={evidence?.statusTitle ?? (unavailable ? 'Files unavailable' : evidence && !evidence.pending ? 'Files current' : 'Reading project files…')} tone={unavailable ? 'error' : evidence?.statusTitle ? 'warning' : 'neutral'} action={<>{evidence?.back}{evidence?.retry ? <Button size="small" variant="quiet" onClick={evidence.retry}>Retry</Button> : null}</>} details={evidence?.status}/></div></header>
 <div className={styles.explorer}><nav className={styles.rail} aria-label="Project folders">{evidence?.rail??<><Button variant="quiet" size="small" disabled>Project folder</Button><Button variant="quiet" size="small" aria-current={controls.source==='website'?'page':undefined} onClick={()=>source('website')}>Website enquiry files</Button></>}</nav>
 {controls.source==='website'?<div className={styles.website}>{evidence?.website??<EnquiryFilesSurface evidence={null} unavailable={unavailable}/>}</div>:<>
 <div className={styles.browser}><div className={styles.toolbar}><nav className={styles.breadcrumbs} aria-label="Folder path">{evidence?.breadcrumbs??<Button size="small" variant="quiet" disabled>Project folder</Button>}</nav><Input aria-label="Find in this folder" placeholder="Find in this folder" value={controls.term} maxLength={200} onChange={event=>find(event.target.value)}/></div>
<div className={styles.finding} role="status">{evidence?evidence.finding:(unavailable?'Files unavailable':'Reading project files…')}</div>
 <div ref={controls.listRef} className={styles.list} aria-label="Files list" tabIndex={0} onScroll={event=>{controls.interact();evidence?.onScroll(event);}} onWheel={takeControl} onTouchMove={takeControl} onPointerDown={event=>{if(event.target===event.currentTarget)takeControl();}} onKeyDown={event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(event.key))takeControl();}}>
 <Table className={styles.filesTable}><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Size</TableHead><TableHead><span className={styles.srOnly}>Download</span></TableHead></TableRow></TableHeader><TableBody>{evidence?evidence.rows:<TableRow><TableCell colSpan={3}>{unavailable?'Files unavailable.':<span role="status">Reading project files…</span>}</TableCell></TableRow>}</TableBody></Table>{evidence?.empty}{evidence?.paging}</div></div>
 {evidence?.preview??<aside className={styles.inspector}><p className={styles.empty}>{unavailable?'File preview unavailable.':'Select a file to preview or download.'}</p></aside>}</>}
 </div></section>;
}
export function EnquiryFilesSurface({evidence,unavailable=false}:{evidence:{status:ReactNode;rows:ReactNode;statusTitle?:string;pending?:boolean;retry?:()=>void}|null;unavailable?:boolean}) {
 return <div className={enquiryStyles.panel}><p className={enquiryStyles.intro}>Private files supplied with this project&apos;s website enquiry.</p><ReadStatus title={evidence?.statusTitle ?? (unavailable ? 'Enquiry files unavailable' : !evidence || evidence.pending ? 'Reading enquiry files…' : 'Enquiry files current')} tone={unavailable ? 'error' : evidence?.retry ? 'warning' : 'neutral'} action={evidence?.retry ? <Button variant="quiet" size="small" onClick={evidence.retry}>Retry</Button> : undefined} details={evidence?.pending ? undefined : evidence?.status} />
 <Table className={enquiryStyles.table} viewportClassName={enquiryStyles.viewport}><colgroup><col style={{width:'60%'}}/><col style={{width:'18%'}}/><col style={{width:'10%'}}/><col style={{width:'12%'}}/></colgroup><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Submitted</TableHead><TableHead>Size</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{evidence?evidence.rows:<TableRow><TableCell colSpan={4}><span role="status">{unavailable?'Enquiry files unavailable':'Reading enquiry files…'}</span></TableCell></TableRow>}</TableBody></Table></div>;
}
export function ProjectFilesWorkspace({projectId,children}:{projectId:string;children:ReactNode}) {
  return <div className={workspaceStyles.workspace} data-project-files-workspace="true" data-project-files-id={projectId}>{children}</div>;
}
