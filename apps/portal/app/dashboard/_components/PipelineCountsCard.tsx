import type { CSSProperties } from 'react';
import type { PipelineCounts } from '@/lib/dashboard/types';
import type { ProjectOperationalStateCounts } from '@/lib/projects/workItems/stateCounts';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';
import { journeyHref, projectStateHref } from '@/lib/dashboard/links';
import { normalizePipelineStageKey, toCanonicalStageCounts } from '@/lib/projects/pipelineDefinition';
import {
  aggregateProjectStageCountsByJourney,
  PROJECT_JOURNEY_PHASE_LABELS,
  PROJECT_JOURNEY_PHASES,
} from '@/lib/projects/projectJourney';
import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';

const OPERATIONAL_STATES = ['ACTIVE', 'WAITING', 'CLOSED', 'ARCHIVED'] as const;

export default function PipelineCountsCard({
  counts,
  stateCounts,
  stateCountsAvailable = true,
  loading = false,
}: {
  counts?: PipelineCounts;
  stateCounts?: ProjectOperationalStateCounts;
  stateCountsAvailable?: boolean;
  loading?: boolean;
}) {
  const normalized = toCanonicalStageCounts(counts ?? {});
  const journeyCounts = aggregateProjectStageCountsByJourney(normalized);
  const gridStyle = {
    gridTemplateColumns: `repeat(${PROJECT_JOURNEY_PHASES.length}, minmax(0, 1fr))`,
  } satisfies CSSProperties;

  if (process.env.NODE_ENV !== 'production') {
    const unknown = Object.keys(counts ?? {}).filter((key) => !normalizePipelineStageKey(key));
    if (unknown.length) {
      console.warn('Unknown pipeline stage keys:', unknown);
    }
  }

  return (
    <section
      className={`${styles.section} ${dash.card} ${dash.pipelineCard}`}
      aria-label="Project portfolio"
      aria-busy={loading}
      data-dashboard-card-state={loading ? 'loading' : 'ready'}
      data-portal-shell-region="dashboard-portfolio"
    >
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <h2 className={styles.sectionTitle}>Project portfolio</h2>
        <span className={dash.sectionMeta}>{loading ? 'Updating counts...' : 'Journey and state'}</span>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody} ${dash.cardBodyNoScroll}`}>
        <div className={dash.pipelineStrip}>
          <div className={dash.pipelineGrid} style={gridStyle}>
            {PROJECT_JOURNEY_PHASES.map((phase) => {
              const count = journeyCounts[phase];
              return (
                <ProjectsIndexLink
                  key={phase}
                  className={`${dash.pipelineCell} ${!loading && count > 0 ? dash.pipelineCellActive : ''}`}
                  href={journeyHref(phase)}
                >
                  <span className={dash.pipelineLabel}>{PROJECT_JOURNEY_PHASE_LABELS[phase]}</span>
                  <span className={`${dash.pipelineCount} ${loading || count === 0 ? dash.pipelineCountMuted : ''}`}>
                    {loading ? '--' : count}
                  </span>
                </ProjectsIndexLink>
              );
            })}
          </div>
        </div>
        <div
          className={dash.projectStateGrid}
          aria-label="Project operational states"
          data-project-state-counts={loading ? 'loading' : stateCountsAvailable && stateCounts ? 'ready' : 'unavailable'}
        >
          {OPERATIONAL_STATES.map((state) => (
            <ProjectsIndexLink
              key={state}
              className={dash.projectStateCell}
              href={projectStateHref(state)}
            >
              <span>{state[0]}{state.slice(1).toLowerCase()}</span>
              <strong>{stateCountsAvailable && stateCounts ? stateCounts[state] : '—'}</strong>
            </ProjectsIndexLink>
          ))}
        </div>
      </div>
    </section>
  );
}
