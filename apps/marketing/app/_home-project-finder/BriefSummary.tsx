'use client';

import Link from 'next/link';
import {
  type ProjectPriority,
  type ResidentialProjectFinderHomeDirection,
} from '../../lib/projectFinderContract';
import {
  buildProjectFinderBriefHeading,
} from '../../lib/projectFinderContinuation';
import styles from './projectFinderHomepage.module.css';

type BriefSummaryProps = {
  direction: ResidentialProjectFinderHomeDirection;
  onChangePriorities: () => void;
  pathwayHref: string;
  priorities: readonly ProjectPriority[];
};

export default function BriefSummary({
  direction,
  onChangePriorities,
  pathwayHref,
  priorities,
}: BriefSummaryProps) {
  return (
    <aside
      className={styles.briefSummary}
      aria-labelledby="brief-summary-heading"
      data-brief-summary
    >
      <p className={styles.eyebrow}>Your starting brief</p>
      <h3 id="brief-summary-heading">
        {buildProjectFinderBriefHeading(direction, priorities)}
      </h3>
      <p>
        This is an early direction, not a final design. The roof, structure and
        details still depend on the measured site and project requirements.
      </p>
      <div className={styles.briefActions}>
        <Link
          className={styles.briefPrimaryAction}
          data-project-finder-event="project_pathway_click"
          data-project-direction={direction}
          data-project-priorities={priorities.join(',')}
          data-source-component="brief_summary"
          href={pathwayHref}
        >
          Explore the recommended service
        </Link>
        <button onClick={onChangePriorities} type="button">
          Change priorities
        </button>
      </div>
    </aside>
  );
}
