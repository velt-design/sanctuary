'use client';
import {useCallback,useMemo,useRef,useState,type ReactNode} from 'react';
import ReadStatus from '@/components/page-state/ReadStatus';
import readingStyles from './overview/ProjectOverviewReading.module.css';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { TabNavigation } from '@/components/ui/foundation/FoundationOperational';
import ProjectOverviewLayout from './overview/ProjectOverviewLayout';
import styles from './overview/ProjectWorkFilesCard.module.css';
import workStyles from './overview/ProjectWorkSection.module.css';
import recentStyles from './overview/ProjectRecentNotesEvents.module.css';
export function useOverviewControls(projectId:string) {
 const current=useRef(projectId);current.current=projectId;
 const [state,setState]=useState({projectId,panel:'work' as 'work'|'enquiry',edited:false});
 const selected=state.projectId===projectId?state:{projectId,panel:'work' as const,edited:false};
 const setPanel=useCallback((panel:'work'|'enquiry')=>setState(prior=>current.current!==projectId?prior:{projectId,panel,edited:true}),[projectId]);
 const adoptPanel=useCallback((panel:'work'|'enquiry')=>setState(prior=>current.current!==projectId||prior.projectId===projectId&&(prior.edited||prior.panel===panel)?prior:{projectId,panel,edited:false}),[projectId]);
 return useMemo(()=>({...selected,setPanel,adoptPanel}),[selected.projectId,selected.panel,selected.edited,setPanel,adoptPanel]);
}
export type OverviewControls=ReturnType<typeof useOverviewControls>;
export type ProjectOverviewEvidence={state:string;retry?:()=>unknown;orientation:ReactNode;exception:ReactNode;work:ReactNode;enquiry:ReactNode;positionLabel?:string;workNotice:ReactNode;
 commercial:{content:ReactNode;payment:ReactNode;visits:ReactNode};recent:{notes:ReactNode;events:ReactNode;statusPanel?:ReactNode;before:ReactNode}};
export type OverviewBinding={controls:OverviewControls;publish:(value:ProjectOverviewEvidence|null)=>void};
export default function ProjectOverviewSurface({evidence,controls,onFiles,unavailable=false}:{evidence:ProjectOverviewEvidence|null;controls:OverviewControls;onFiles:()=>void;unavailable?:boolean}) {
const pending = (label:string) => <p role="status">{unavailable ? `${label} unavailable` : `Reading ${label.toLowerCase()}…`}</p>;
return <div className={readingStyles.surface} data-project-overview="true"><ProjectOverviewLayout state={evidence?.state??(unavailable?'unavailable':'pending')}
 exception={<ReadStatus title={unavailable ? 'Project Overview unavailable' : !evidence || evidence.state === 'pending' ? 'Reading Project Overview' : evidence.state === 'stale' ? 'Saved Overview · latest refresh failed' : evidence.state === 'refreshing' ? 'Refreshing Project Overview' : evidence.state === 'ready' ? 'Project Overview current' : 'Project Overview needs attention'}
 tone={unavailable || evidence?.state === 'failed' ? 'error' : evidence?.state === 'stale' || evidence?.state === 'model-mismatch' ? 'warning' : 'neutral'} details={evidence?.exception} onRetry={evidence?.retry}/>}
 orientation={<OverviewReadingCard title="Project details" label="Project orientation" kind="orientation">{evidence?.orientation??pending('Project details')}</OverviewReadingCard>}
 projectWork={<ProjectWorkFilesSurface className={workStyles.card} selectedPanel={controls.panel} selectPanel={controls.setPanel} onFiles={onFiles} positionLabel={evidence?.positionLabel}
 notice={evidence?.workNotice??<ReadStatus title={unavailable?'Project work unavailable':'Reading project work state'}/>}
 enquiry={evidence?.enquiry??pending('Original enquiry')}>
 {evidence?.work??<section data-project-work-section="true" data-project-work-model="pending">{pending('Project work')}</section>}</ProjectWorkFilesSurface>}
 commercial={<><OverviewReadingCard title="Current price" label="Current design and commercial summary" kind="commercial">{evidence?.commercial.content??pending('Commercial state')}</OverviewReadingCard>
 <OverviewReadingCard title="Payment position" label="Payment position" kind="payment">{evidence?.commercial.payment??pending('Payments and invoice balance')}</OverviewReadingCard>
 <OverviewReadingCard title="Site visits" label="Site visits" kind="visits">{evidence?.commercial.visits??pending('Site visits')}</OverviewReadingCard></>}
 recent={<><OverviewReadingCard title="Customer emails" label="Customer conversations" kind="emails" id="customer-emails">{evidence?.recent.before??pending('Customer conversations')}</OverviewReadingCard>
 <ProjectRecentNotesSurface notes={evidence?.recent.notes??pending('Complete notes')}
 events={evidence?.recent.events??pending('Complete events')} statusPanel={evidence?.recent.statusPanel}/></>}/></div>;
}

/** Chrome is public; only this current owner's original guarded body is published. */
function OverviewReadingCard({title,label,kind,children,id}:{title:string;label:string;kind:string;children:ReactNode;id?:string}) {
 return <Card title={title} padding="compact" aria-label={label} id={id} className={readingStyles.card}>
 <div className={readingStyles.reading} data-overview-reading={kind} tabIndex={0} aria-label={`${title} reading area`}>{children}</div></Card>;
}

export function ProjectWorkFilesSurface({ children, enquiry, className, positionLabel, selectedPanel, selectPanel, onFiles, notice }: {
  children: ReactNode; enquiry: ReactNode; className?: string; positionLabel?: string; notice?:ReactNode;
  selectedPanel: 'work' | 'enquiry'; selectPanel: (panel: 'work' | 'enquiry') => void; onFiles: () => void;
}) {
  return (
    <Card
      className={[styles.card, className].filter(Boolean).join(" ")}
      aria-label="Project Work"
      data-project-work-panel={selectedPanel}
      title={positionLabel ?? "Project Work"}
      eyebrow="Project position"
      action={
        <div className={styles.actions}>
        <ButtonLink href={`?tab=files`} prefetch={false} variant="quiet" size="small" onClick={(event) => { event.preventDefault(); onFiles(); }}>Open project files</ButtonLink>
        <TabNavigation
          className={styles.tabs}
          ariaLabel="Project Work sections"
          items={[
            { key: "work", label: "Work", controls: "project-work-panel" },
            { key: "enquiry", label: "Original enquiry", controls: "project-enquiry-panel" },
          ]}
          selectedKey={selectedPanel}
          onSelect={selectPanel}
        />
        </div>
      }
      padding="compact"
    >
      <div className={readingStyles.workStatus}>{notice}</div>
      <div className={readingStyles.reading} data-overview-reading="work" tabIndex={0} aria-label="Project Work reading area">
      {selectedPanel === "enquiry" ? (
        <div id="project-enquiry-panel" role="tabpanel" aria-label="Original enquiry">
          {enquiry}
        </div>
      ) : (
        <div id="project-work-panel" role="tabpanel" aria-label="Work">
          {children}
        </div>
      )}
      </div>
    </Card>
  );
}


export function ProjectRecentNotesSurface({notes,events,statusPanel}: {notes:ReactNode;events:ReactNode;statusPanel?:ReactNode}) {
  return (
    <details>
    <summary style={{ cursor: 'pointer', padding: 'var(--ui-space-3)', fontWeight: 600 }}>Team notes & portal history</summary>
    <Card
      className={recentStyles.card}
      title="Recent notes and events"
      padding="none"
      aria-label="Recent notes and events"
      data-recent-notes-events="true"
    >
      <div className={readingStyles.history} tabIndex={0} aria-label="Recent notes and events reading area">
      {statusPanel}
      <div className={recentStyles.layout}>
        <section
          className={recentStyles.notes}
          aria-labelledby="project-notes-heading"
        >
          <h3 id="project-notes-heading">Team notes</h3>
          {notes}
        </section>
        <section
          className={recentStyles.events}
          aria-labelledby="project-events-heading"
        >
          <h3 id="project-events-heading">Recent system events</h3>
          <p>Portal activity only. Customer conversations are not included here.</p>
          {events}
        </section>
      </div>
      </div>
    </Card>
    </details>
  );
}
