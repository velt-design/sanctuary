import Link from 'next/link';
import { Container, Eyebrow, Heading } from '@/components/marketing-foundation';
import type { GuidedJourneyContext as GuidedJourneyContextModel } from '@/lib/guidedJourneyContext';
import styles from './GuidedJourneyContext.module.css';

type GuidedJourneyContextProps = {
  context: GuidedJourneyContextModel | null;
};

export default function GuidedJourneyContext({
  context,
}: GuidedJourneyContextProps) {
  if (!context) return null;

  return (
    <section
      className={styles.root}
      aria-labelledby="guided-journey-context-title"
      data-guided-journey-context
      data-guided-result={context.resultId}
      data-guided-focus={context.focusId}
      data-guided-experience={context.analyticsProperties.experience_variant}
    >
      <Container width="wide" className={styles.layout}>
        <div className={styles.selection}>
          <Eyebrow className={styles.eyebrow}>Your starting point</Eyebrow>
          <p>{context.focusLabel}</p>
        </div>
        <div className={styles.copy}>
          <Heading as="h2" id="guided-journey-context-title">
            {context.title}
          </Heading>
          <p>{context.explanation}</p>
        </div>
        <Link className={styles.changeLink} href={context.returnHref}>
          Change answers
        </Link>
      </Container>
    </section>
  );
}
