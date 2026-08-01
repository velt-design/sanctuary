'use client';

import Link from 'next/link';
import type { RefObject } from 'react';
import { buildEnquiryHref } from '../../lib/enquiryContext';
import {
  PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
  PROJECT_FINDER_HOME_PATH,
  type ProjectDirection,
  type ProjectPriority,
} from '../../lib/projectFinderContract';
import { Container } from '../../components/marketing-foundation/Primitives';
import { projectDirectionContent } from './projectFinderContent';
import styles from './projectFinderHomepage.module.css';

type ProjectFinderResultProps = {
  direction: ProjectDirection;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onOpenBrief: () => void;
  priorities: readonly ProjectPriority[];
  resultRef: RefObject<HTMLElement | null>;
};

export default function ProjectFinderResult({
  direction,
  headingRef,
  onOpenBrief,
  priorities,
  resultRef,
}: ProjectFinderResultProps) {
  const content = projectDirectionContent[direction];
  const enquiryHref = buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: PROJECT_FINDER_HOME_PATH,
    sourceComponent: 'project_finder',
    sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
    projectDirection: direction,
    projectPriorities: [...priorities],
  });

  return (
    <section
      className={styles.result}
      ref={resultRef}
      aria-labelledby="project-finder-result-heading"
      data-project-finder-result={direction}
    >
      <Container className={styles.resultLayout} width="wide">
        <div className={styles.resultCopy}>
          <p className={styles.eyebrow}>Your closest starting point</p>
          <h2 id="project-finder-result-heading" ref={headingRef} tabIndex={-1}>
            {content.responseHeading}
          </h2>
          <p>{content.responseExplanation}</p>
        </div>
        <div className={styles.resultActions}>
          <Link
            className={styles.resultPrimaryAction}
            data-project-finder-event="project_pathway_click"
            data-project-direction={direction}
            data-project-priorities={priorities.join(',')}
            data-source-component="project_finder"
            href={content.pathwayHref}
          >
            {content.pathwayLabel}
          </Link>
          <button onClick={onOpenBrief} type="button">
            Refine what matters
          </button>
          <div className={styles.escapeActions}>
            <Link href="/projects">View all projects</Link>
            <Link
              data-project-finder-event="project_finder_direct_enquiry_click"
              data-project-direction={direction}
              data-project-priorities={priorities.join(',')}
              data-source-component="project_finder"
              href={enquiryHref}
            >
              Start your project now
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
