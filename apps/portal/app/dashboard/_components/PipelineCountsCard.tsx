import type { CSSProperties } from 'react';
import type { PipelineCounts } from '@/lib/dashboard/types';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import dash from '../dashboard.module.css';
import { statusHref } from '@/lib/dashboard/links';
import { PIPELINE_STAGES, normalizePipelineStageKey, toCanonicalStageCounts } from '@/lib/projects/pipelineDefinition';
import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';

export default function PipelineCountsCard({ counts }: { counts: PipelineCounts }) {
  const normalized = toCanonicalStageCounts(counts);
  const gridStyle = {
    gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, minmax(0, 1fr))`,
  } satisfies CSSProperties;

  if (process.env.NODE_ENV !== 'production') {
    const keys = PIPELINE_STAGES.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      console.warn('PIPELINE_STAGES contains duplicates', keys);
    }

    const unknown = Object.keys(counts ?? {}).filter((key) => !normalizePipelineStageKey(key));
    if (unknown.length) {
      console.warn('Unknown pipeline stage keys:', unknown);
    }
  }

  return (
    <section className={`${styles.section} ${dash.card} ${dash.pipelineCard}`} aria-label="Pipeline counts">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <h2 className={styles.sectionTitle}>Pipeline</h2>
        <span className={dash.sectionMeta}>Counts by stage</span>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody} ${dash.cardBodyNoScroll}`}>
        <div className={dash.pipelineStrip}>
          <div className={dash.pipelineGrid} style={gridStyle}>
            {PIPELINE_STAGES.map((stage) => {
              const count = normalized[stage.key] ?? 0;
              return (
                <ProjectsIndexLink
                  key={stage.key}
                  className={`${dash.pipelineCell} ${count > 0 ? dash.pipelineCellActive : ''}`}
                  href={statusHref(stage.key)}
                >
                  <span className={dash.pipelineLabel}>{stage.label}</span>
                  <span className={`${dash.pipelineCount} ${count === 0 ? dash.pipelineCountMuted : ''}`}>{count}</span>
                </ProjectsIndexLink>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
