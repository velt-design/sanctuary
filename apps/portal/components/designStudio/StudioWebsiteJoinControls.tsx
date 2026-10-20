'use client';
import {useEffect,useRef} from 'react';
import {useLighting} from '@sp/configurator/react/controls';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import type {WebsiteJoin} from '@/lib/designStudio/websiteJoinIntent';
import {websiteJoinStates} from '@/lib/designStudio/websiteJoins';
import css from './StudioWebsite.module.css';
export default function StudioWebsiteJoinControls({edit,objectId,draft,onDraft,onCommit,onRemove,error,focused=false,onBack}:{edit:StudioAuthoringEdit;objectId:string;draft:WebsiteJoin|null;onDraft:(value:WebsiteJoin|null)=>void;onCommit:()=>void;onRemove:(id:string)=>void;error:string|null;focused?:boolean;onBack?:()=>void}){
 const light=useLighting();
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(focused)heading.current?.focus({preventScroll:true});},[focused,objectId]);
 const choose=(value:WebsiteJoin|null)=>{if(value)light?.setView('Plan');onDraft(value);};
 const object=edit.spatial.pergolas.find(p=>p.id===(draft?.a.objectId??objectId))!,states=websiteJoinStates(edit).filter(s=>s.join.a.objectId===objectId||s.join.b.objectId===objectId);
 return <section className={css.joinControls}><>{focused&&<button className={css.quietButton} onClick={onBack}>Back to position</button>}<h3 ref={heading} tabIndex={-1}>Pergola joins</h3></>{states.map(s=><div key={s.join.id}><p>{s.label}</p>{s.error&&<p role="alert" className={css.fieldError}>{s.error}</p>}<button className={css.quietButton} disabled={Boolean(edit.spatial.pergolas.find(p=>p.id===s.join.a.objectId)?.attachment?.host)} onClick={()=>choose(s.join)}>Reposition to join</button><button className={css.quietButton} onClick={()=>onRemove(s.join.id)}>Remove join</button></div>)}
 {!draft?<><button className={css.quietButton} disabled={Boolean(object.attachment?.host)||edit.spatial.pergolas.length<2} onClick={()=>choose({id:crypto.randomUUID(),a:{objectId,edge:'right'},b:{objectId:'',edge:'left'},alignment:'centre'})}>Join to pergola</button>{object.attachment?.host&&<p>Select a free pergola to move toward this attached pergola.</p>}</>:<>
 <label className={css.field}>Moving edge<select aria-label="Moving pergola edge" value={draft.a.edge} onChange={e=>onDraft({...draft,a:{...draft.a,edge:e.target.value as WebsiteJoin['a']['edge']}})}>{['front','rear','left','right'].map(edge=><option key={edge}>{edge}</option>)}</select></label>
 <p>Choose a named target edge in Plan. {object.label} will move only when you choose Join.</p>
 <label className={css.field}>Alignment<select aria-label="Join alignment" value={draft.alignment} onChange={e=>onDraft({...draft,alignment:e.target.value as WebsiteJoin['alignment']})}><option value="start">Start</option><option value="centre">Centre</option><option value="end">End</option></select></label>
 {draft.b.objectId&&<p>{object.label} · {draft.a.edge} → {edit.spatial.pergolas.find(p=>p.id===draft.b.objectId)?.label} · {draft.b.edge}</p>}
 {error&&<p role="alert" className={css.fieldError}>{error}</p>}
 <button className={css.quietButton} disabled={!draft.b.objectId||Boolean(error)} onClick={onCommit}>Join</button><button className={css.quietButton} onClick={()=>choose(null)}>Cancel join</button>
 </>}{(draft||states.length>0)&&<p>Products and stock remain separate. Removing a join keeps their positions.</p>}</section>;
}

/** Geometry failures need an authored repair; network failures retain retry. */
export function JoinPriceRecovery({invalidLabel,onCheck,error,onRetry}:{invalidLabel?:string;onCheck:()=>void;error:string|null;onRetry:()=>void}){
 return invalidLabel?<button aria-label={`Check join: ${invalidLabel}`} onClick={onCheck}>Check join</button>:error?<button onClick={onRetry}>Retry price</button>:null;
}
