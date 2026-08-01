'use client';

import Image from 'next/image';
import { Container } from '../../components/marketing-foundation/Primitives';
import type {
  GuidedAnswerValue,
  GuidedQuestion as GuidedQuestionModel,
} from './guidedConversationModel';
import type { GuidedHomepageMedia } from './guidedConversationMedia';
import GuidedQuestion, { type GuidedInputMethod } from './GuidedQuestion';
import styles from './guidedHomepage.module.css';

type GuidedHeroProps = {
  audienceQuestion?: GuidedQuestionModel;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  media: GuidedHomepageMedia;
  onAnswer: (
    answer: GuidedAnswerValue,
    inputMethod: GuidedInputMethod,
  ) => void;
};

export default function GuidedHero({
  audienceQuestion,
  headingRef,
  media,
  onAnswer,
}: GuidedHeroProps) {
  return (
    <section
      className={`${styles.hero} ${audienceQuestion ? styles.heroWithQuestion : styles.heroCompact}`}
      aria-labelledby="guided-home-heading"
      data-guided-home-hero
    >
      <Image
        alt={media.hero.alt}
        className={styles.heroImage}
        fill
        fetchPriority="high"
        priority
        sizes="100vw"
        src={media.hero.src}
        style={{ objectPosition: media.hero.objectPosition }}
      />
      <div className={styles.heroShade} aria-hidden="true" />
      <Container className={styles.heroContent} width="wide">
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>
            Fixed-roof pergola design and build in Auckland
          </p>
          <h1 id="guided-home-heading" ref={headingRef} tabIndex={-1}>
            What are you planning?
          </h1>
          <p id="guided-home-support">
            Choose the closest starting point. We&apos;ll show you the most
            relevant approach.
          </p>
        </div>
        {audienceQuestion ? (
          <GuidedQuestion
            headingRef={headingRef}
            onAnswer={onAnswer}
            optionMedia={media.optionByAnswer}
            presentation="hero"
            question={audienceQuestion}
          />
        ) : (
          <p className={styles.heroProjectMeta}>
            {media.hero.projectTitle} / {media.hero.location}
          </p>
        )}
      </Container>
    </section>
  );
}
