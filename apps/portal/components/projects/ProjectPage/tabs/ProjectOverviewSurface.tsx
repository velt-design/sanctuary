'use client';
import {useCallback,useMemo,useRef,useState,type ReactNode} from 'react';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { TabNavigation } from '@/components/ui/foundation/FoundationOperational';
import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';
import ProjectOverviewLayout from './overview/ProjectOverviewLayout';
import styles from './overview/ProjectWorkFilesCard.module.css';
import workStyles from './overview/ProjectWorkSection.module.css';
import commercialStyles from './overview/ProjectCommercialDetails.module.css';
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
export type ProjectOverviewEvidence={state:string;orientation:ReactNode;exception:ReactNode;work:ReactNode;enquiry:ReactNode;positionLabel?:string;workNotice:ReactNode;
 commercial:{data:ProjectCommandCentreCurrentDesign|null;pending:boolean;closed:boolean;content:ReactNode;after:ReactNode};recent:{notes:ReactNode;events:ReactNode;statusPanel?:ReactNode;before:ReactNode}};
export type OverviewBinding={controls:OverviewControls;publish:(value:ProjectOverviewEvidence|null)=>void};
export default function ProjectOverviewSurface({evidence,controls,onFiles,unavailable=false}:{evidence:ProjectOverviewEvidence|null;controls:OverviewControls;onFiles:()=>void;unavailable?:boolean}) {
return <div data-project-overview="true"><ProjectOverviewLayout state={evidence?.state??(unavailable?'unavailable':'pending')}
 orientation={evidence?.orientation} exception={evidence?.exception}
 projectWork={<><ProjectWorkFilesSurface className={workStyles.card} selectedPanel={controls.panel} selectPanel={controls.setPanel} onFiles={onFiles} positionLabel={evidence?.positionLabel}
 enquiry={evidence?.enquiry??<p role="status">{unavailable?'Original enquiry unavailable':'Reading original enquiry…'}</p>}>
 {evidence?.work??<section data-project-work-section="true" data-project-work-model="pending"><p role="status">{unavailable?'Project work unavailable':'Reading project work…'}</p></section>}</ProjectWorkFilesSurface>{evidence?.workNotice}</>}
 commercial={<><ProjectCommercialDetailsSurface data={evidence?.commercial.data??null} pending={evidence?.commercial.pending??!unavailable} closed={evidence?.commercial.closed}>
 {evidence?.commercial.content??<p role="status">{unavailable?'Commercial state unavailable':'Reading current design and commercial state…'}</p>}</ProjectCommercialDetailsSurface>{evidence?.commercial.after}</>}
 recent={<>{evidence?.recent.before}<ProjectRecentNotesSurface notes={evidence?.recent.notes??<p role="status">{unavailable?'Complete notes unavailable':'Reading complete notes…'}</p>}
 events={evidence?.recent.events??<p role="status">{unavailable?'Complete events unavailable':'Reading complete events…'}</p>} statusPanel={evidence?.recent.statusPanel}/></>}/></div>;
}
export function ProjectWorkFilesSurface({ children, enquiry, className, positionLabel, selectedPanel, selectPanel, onFiles }: {
  children: ReactNode; enquiry: ReactNode; className?: string; positionLabel?: string;
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
      {selectedPanel === "enquiry" ? (
        <div id="project-enquiry-panel" role="tabpanel" aria-label="Original enquiry">
          {enquiry}
        </div>
      ) : (
        <div id="project-work-panel" role="tabpanel" aria-label="Work">
          {children}
        </div>
      )}
    </Card>
  );
}

export function ProjectCommercialDetailsSurface({ data, pending = false, children, closed = false }: { pending?: boolean; data: ProjectCommandCentreCurrentDesign | null; children: ReactNode; closed?: boolean }) {
  // Simplify ordinary facts, never conceal a commercial exception behind a total.
  if (data && (data.warnings.length || data.quote?.deliveryState === 'failed' || data.latestDeclinedQuote || data.estimate?.costingState === 'may_be_stale')) return <>{children}</>;
  const cents = data?.price.totalIncGstCents;
  const label = !data ? 'Current price' : closed ? 'Recorded price' : data?.source === 'accepted_quote' ? 'Agreed price' : data?.source === 'sent_quote' ? 'Proposed price' : data?.source === 'draft_quote' ? 'Draft quote' : 'Current estimate';
  return <details className={commercialStyles.details}>
    <summary>
      <span className={commercialStyles.label}>{label}</span>
      <strong className={commercialStyles.price}>{!data ? (pending ? 'Reading price' : 'Price unavailable') : cents == null ? (data?.source === 'none' ? 'Not prepared' : 'Unavailable') : new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 }).format(cents / 100)}</strong>
      <span className={commercialStyles.hint}>{cents == null ? '' : 'NZD inc GST · '}Quote & design details</span>
    </summary>
    <div className={commercialStyles.content}>{children}</div>
  </details>;
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
    </Card>
    </details>
  );
}
