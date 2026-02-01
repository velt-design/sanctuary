import Link from 'next/link';
import type { PipelineCounts } from '@/lib/dashboard/types';
import styles from '@/app/staff/projects/projects.module.css';
import dash from '../dashboard.module.css';
import { statusHref } from '@/lib/dashboard/links';
import { PIPELINE_STAGES, normalizeStageKey } from '@/lib/dashboard/pipelineStages';

export default function PipelineCountsCard({ counts }: { counts: PipelineCounts }) {
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts ?? {})) {
    const normalizedKey = normalizeStageKey(key);
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    normalized[normalizedKey] = (normalized[normalizedKey] ?? 0) + (Number.isFinite(n) ? n : 0);
  }

  if (process.env.NODE_ENV !== 'production') {
    const keys = PIPELINE_STAGES.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      console.warn('PIPELINE_STAGES contains duplicates', keys);
    }
  }

  return (
    <section className={styles.section} aria-label="Pipeline counts">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Pipeline</h2>
        <span className={dash.sectionMeta}>Counts by stage</span>
      </div>
      <div className={styles.sectionBody}>
        <div className={dash.pipelineGrid}>
          {PIPELINE_STAGES.map((stage) => {
            const count = normalized[stage.key] ?? 0;
            return (
              <Link key={stage.key} className={dash.pipelineItem} href={statusHref(stage.key)}>
                <span className={styles.statusPill}>{stage.label}</span>
                <span className={`${dash.pipelineCount} ${count === 0 ? dash.pipelineCountMuted : ''}`}>{count}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
