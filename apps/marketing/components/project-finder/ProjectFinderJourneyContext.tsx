import Link from 'next/link';
import { Container, Eyebrow, Heading } from '@/components/marketing-foundation';
import type { ProjectFinderJourneyContext as ProjectFinderJourneyContextModel } from '@/lib/projectFinderContinuation';
import styles from './ProjectFinderJourneyContext.module.css';

type ProjectFinderJourneyContextProps = {
  context: ProjectFinderJourneyContextModel | null;
};

export default function ProjectFinderJourneyContext({
  context,
}: ProjectFinderJourneyContextProps) {
  if (!context) return null;

  return (
    <section
      className={styles.root}
      aria-labelledby="project-finder-journey-title"
      data-project-finder-journey-context
      data-project-direction={context.direction}
      data-project-priorities={context.priorities.join(',')}
    >
      <Container className={styles.layout} width="wide">
        <div className={styles.copy}>
          <Eyebrow className={styles.eyebrow}>Your saved starting brief</Eyebrow>
          <Heading as="h2" id="project-finder-journey-title">
            {context.summaryHeading}
          </Heading>
          <p>
            We have kept this direction with you. It will be included if you
            enquire from this page.
          </p>
        </div>
        <nav className={styles.actions} aria-label="Your saved project brief">
          <a href="#project-details">Continue to enquiry</a>
          <Link href={context.returnHref}>Refine your brief</Link>
        </nav>
      </Container>
    </section>
  );
}
