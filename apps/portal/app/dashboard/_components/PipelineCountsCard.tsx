import Link from 'next/link';
import type { PipelineCounts } from '@/lib/dashboard/types';
import styles from '@/app/staff/projects/projects.module.css';
import dash from '../dashboard.module.css';
import { statusHref } from '@/lib/dashboard/links';
import { PIPELINE_STAGES, normalizePipelineStageId, toCanonicalStageCounts } from '@/lib/dashboard/pipelineStages';

export default function PipelineCountsCard({ counts }: { counts: PipelineCounts }) {
  const normalized = toCanonicalStageCounts(counts);

  if (process.env.NODE_ENV !== 'production') {
    const keys = PIPELINE_STAGES.map((s) => s.id);
    if (new Set(keys).size !== keys.length) {
      console.warn('PIPELINE_STAGES contains duplicates', keys);
    }

    const unknown = Object.keys(counts ?? {}).filter((key) => !normalizePipelineStageId(key));
    if (unknown.length) {
      console.warn('Unknown pipeline stage keys:', unknown);
    }
  }

  return (
    <section className={`${styles.section} ${dash.card}`} aria-label="Pipeline counts">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <h2 className={styles.sectionTitle}>Pipeline</h2>
        <span className={dash.sectionMeta}>Counts by stage</span>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody} ${dash.cardBodyNoScroll}`}>
        <div className={dash.pipelineStrip}>
          <div className={dash.pipelineGrid}>
            {PIPELINE_STAGES.map((stage) => {
              const count = normalized[stage.id] ?? 0;
              return (
                <Link
                  key={stage.id}
                  className={`${dash.pipelineCell} ${count > 0 ? dash.pipelineCellActive : ''}`}
                  href={statusHref(stage.id)}
                >
                  <span className={dash.pipelineLabel}>{stage.label}</span>
                  <span className={`${dash.pipelineCount} ${count === 0 ? dash.pipelineCountMuted : ''}`}>{count}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
