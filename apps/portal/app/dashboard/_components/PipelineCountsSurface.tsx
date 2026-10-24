import type {CSSProperties} from 'react';
import type {ProjectOperationalStateCounts} from '@/lib/projects/workItems/stateCounts';
import {PROJECT_JOURNEY_PHASES,PROJECT_JOURNEY_PHASE_LABELS,type ProjectJourneyPhase} from '@/lib/projects/projectJourney';
import {journeyHref,projectStateHref} from '@/lib/dashboard/links';
import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';
const OPERATIONAL_STATES=['ACTIVE','WAITING','CLOSED','ARCHIVED'] as const;
export type JourneyCounts=Partial<Record<ProjectJourneyPhase,number>>;
export default function PipelineCountsSurface({journeyCounts,pending=false,statePending=pending,countsAvailable=true,stateCounts,stateCountsAvailable=true}:{journeyCounts?:JourneyCounts;pending?:boolean;statePending?:boolean;countsAvailable?:boolean;stateCounts?:ProjectOperationalStateCounts;stateCountsAvailable?:boolean}){
 const gridStyle={gridTemplateColumns:`repeat(${PROJECT_JOURNEY_PHASES.length}, minmax(0, 1fr))`} satisfies CSSProperties;
  return (
    <section className={`${styles.section} ${dash.card} ${dash.pipelineCard}`} aria-label="Project portfolio" data-dashboard-portfolio={pending?"pending":countsAvailable?"ready":"unavailable"}>
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <h2 className={styles.sectionTitle}>Project portfolio</h2>
        <span className={dash.sectionMeta}>{pending?'Reading portfolio…':countsAvailable ? 'Journey and state' : 'Journey counts unavailable'}</span>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody} ${dash.cardBodyNoScroll}`}>
        <div className={dash.pipelineStrip}>
          <div className={dash.pipelineGrid} style={gridStyle}>
            {PROJECT_JOURNEY_PHASES.map((phase) => {
              const count = journeyCounts?.[phase];
              return (
                <ProjectsIndexLink
                  key={phase}
                  className={`${dash.pipelineCell} ${count !== undefined && count > 0 ? dash.pipelineCellActive : ''}`}
                  href={journeyHref(phase)}
                >
                  <span className={dash.pipelineLabel}>{PROJECT_JOURNEY_PHASE_LABELS[phase]}</span>
                  <span className={`${dash.pipelineCount} ${count === 0 ? dash.pipelineCountMuted : ''}`}>{pending?'Reading…':countsAvailable ? count : '—'}</span>
                </ProjectsIndexLink>
              );
            })}
          </div>
        </div>
        <p className={dash.pipelineScope}>Enquiry and Proposal show active and waiting projects.</p>
        <div
          className={dash.projectStateGrid}
          aria-label="Project operational states"
          data-project-state-counts={statePending?'pending':stateCountsAvailable && stateCounts ? 'ready' : 'unavailable'}
        >
          {OPERATIONAL_STATES.map((state) => (
            <ProjectsIndexLink
              key={state}
              className={dash.projectStateCell}
              href={projectStateHref(state)}
            >
              <span>{state[0]}{state.slice(1).toLowerCase()}</span>
              <strong>{statePending?'Reading…':stateCountsAvailable && stateCounts ? stateCounts[state] : '—'}</strong>
            </ProjectsIndexLink>
          ))}
        </div>
      </div>
    </section>
  );
}
