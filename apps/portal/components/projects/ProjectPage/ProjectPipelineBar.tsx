import type { ProjectStage } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';
import LegacyChevronPipeline from '@/components/projects/legacyStyle/LegacyChevronPipeline';

export default function ProjectPipelineBar({ stage }: { stage: ProjectStage }) {
  return (
    <section className={legacy.section} aria-label="Pipeline">
      <div className={legacy.sectionHeader}>
        <h2 className={legacy.sectionTitle}>Pipeline</h2>
      </div>
      <div className={legacy.sectionBody}>
        <LegacyChevronPipeline stage={stage} />
      </div>
    </section>
  );
}
