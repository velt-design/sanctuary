'use client';

import Link from 'next/link';
import { buildEnquiryHref } from '../../lib/enquiryContext';
import {
  PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
  PROJECT_FINDER_HOME_PATH,
  type ProjectDirection,
  type ProjectPriority,
} from '../../lib/projectFinderContract';
import {
  buildBriefHeading,
  projectDirectionContent,
} from './projectFinderContent';
import styles from './projectFinderHomepage.module.css';

type BriefSummaryProps = {
  direction: ProjectDirection;
  onChangePriorities: () => void;
  priorities: readonly ProjectPriority[];
};

export default function BriefSummary({
  direction,
  onChangePriorities,
  priorities,
}: BriefSummaryProps) {
  const content = projectDirectionContent[direction];
  const enquiryHref = buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: PROJECT_FINDER_HOME_PATH,
    sourceComponent: 'brief_summary',
    sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
    projectDirection: direction,
    projectPriorities: [...priorities],
  });

  return (
    <aside
      className={styles.briefSummary}
      aria-labelledby="brief-summary-heading"
      data-brief-summary
    >
      <p className={styles.eyebrow}>Your starting brief</p>
      <h3 id="brief-summary-heading">
        {buildBriefHeading(direction, priorities)}
      </h3>
      <p>
        This is an early direction, not a final design. The roof, structure and
        details still depend on the measured site and project requirements.
      </p>
      <div className={styles.briefActions}>
        <Link
          className={styles.briefPrimaryAction}
          data-project-finder-event="brief_enquiry_click"
          data-project-direction={direction}
          data-project-priorities={priorities.join(',')}
          data-source-component="brief_summary"
          href={enquiryHref}
        >
          Send this brief to Sanctuary
        </Link>
        <Link
          data-project-finder-event="project_pathway_click"
          data-project-direction={direction}
          data-project-priorities={priorities.join(',')}
          data-source-component="brief_summary"
          href={content.pathwayHref}
        >
          Explore the recommended pathway
        </Link>
        <button onClick={onChangePriorities} type="button">
          Change priorities
        </button>
      </div>
    </aside>
  );
}
