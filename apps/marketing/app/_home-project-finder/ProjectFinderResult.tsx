'use client';

import Link from 'next/link';
import type { RefObject } from 'react';
import {
  type CommercialProfessionalPath,
  type ProjectFinderHomeDirection,
  type ProjectPriority,
} from '../../lib/projectFinderContract';
import { Container } from '../../components/marketing-foundation/Primitives';
import type { ProjectResultContent } from './projectFinderContent';
import styles from './projectFinderHomepage.module.css';

type ProjectFinderResultProps = {
  content: ProjectResultContent;
  direction: ProjectFinderHomeDirection;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onOpenBrief?: () => void;
  pathwayHref: string;
  priorities: readonly ProjectPriority[];
  professionalPath?: CommercialProfessionalPath;
  resultKey: string;
  resultRef: RefObject<HTMLElement | null>;
};

export default function ProjectFinderResult({
  content,
  direction,
  headingRef,
  onOpenBrief,
  pathwayHref,
  priorities,
  professionalPath,
  resultKey,
  resultRef,
}: ProjectFinderResultProps) {
  return (
    <section
      className={styles.result}
      ref={resultRef}
      aria-labelledby="project-finder-result-heading"
      data-project-finder-result={resultKey}
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
            data-professional-path={professionalPath}
            data-project-priorities={priorities.join(',')}
            data-source-component="project_finder"
            href={pathwayHref}
          >
            {content.pathwayLabel}
          </Link>
          {onOpenBrief ? (
            <button onClick={onOpenBrief} type="button">
              Refine what matters
            </button>
          ) : null}
          <div className={styles.escapeActions}>
            <Link href="/projects">View all projects</Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
