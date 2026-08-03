'use client';

import Link from 'next/link';
import { Container } from '../../components/marketing-foundation/Primitives';
import type {
  CommercialProfessionalPath,
  ProjectFinderHomeDirection,
  ProjectPriority,
} from '../../lib/projectFinderContract';
import type { ProjectResultContent } from './projectFinderContent';
import styles from './projectFinderHomepage.module.css';

type ProjectFinderCloseProps = {
  content: ProjectResultContent;
  direction: ProjectFinderHomeDirection;
  enquiryHref: string;
  onReset: () => void;
  priorities: readonly ProjectPriority[];
  professionalPath?: CommercialProfessionalPath;
};

export default function ProjectFinderClose({
  content,
  direction,
  enquiryHref,
  onReset,
  priorities,
  professionalPath,
}: ProjectFinderCloseProps) {
  return (
    <section
      className={styles.close}
      aria-labelledby="project-finder-close-heading"
    >
      <Container className={styles.closeLayout} width="wide">
        <div>
          <p className={styles.eyebrow}>After exploring the work</p>
          <h2 id="project-finder-close-heading">{content.closeHeading}</h2>
          <p>{content.closeExplanation}</p>
        </div>
        <div className={styles.closeActions}>
          <Link
            className={styles.closePrimaryAction}
            data-project-finder-event="project_finder_direct_enquiry_click"
            data-project-direction={direction}
            data-project-priorities={priorities.join(',')}
            data-professional-path={professionalPath}
            data-source-component="project_finder"
            href={enquiryHref}
          >
            Send your brief
          </Link>
          <a href="tel:+64228545633">Call Sanctuary</a>
          <button className={styles.reset} onClick={onReset} type="button">
            Start again
          </button>
        </div>
      </Container>
    </section>
  );
}
