'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { RefObject } from 'react';
import type { GuidedResult as GuidedResultModel } from './guidedConversationModel';
import type { GuidedMedia } from './guidedConversationMedia';
import styles from './guidedHomepage.module.css';

type GuidedResultProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  media: GuidedMedia;
  onChangeAnswers: () => void;
  onResultClick: () => void;
  result: GuidedResultModel;
};

export default function GuidedResult({
  headingRef,
  media,
  onChangeAnswers,
  onResultClick,
  result,
}: GuidedResultProps) {
  return (
    <section
      className={styles.result}
      aria-labelledby={`guided-result-${result.id}`}
      data-guided-result={result.id}
    >
      <figure className={styles.resultMedia}>
        <Image
          alt={media.alt}
          fill
          sizes="(max-width: 900px) calc(100vw - 2.5rem), 48vw"
          src={media.src}
          style={{ objectPosition: media.objectPosition }}
        />
        <figcaption>
          <strong>{media.projectTitle}</strong>
          <span>{media.location}</span>
        </figcaption>
      </figure>
      <div className={styles.resultContent}>
        <div className={styles.resultCopy}>
          <p className={styles.eyebrow}>Your best starting point</p>
          <div className={styles.questionTitleRow}>
            <h2
              id={`guided-result-${result.id}`}
              ref={headingRef}
              tabIndex={-1}
            >
              {result.title}
            </h2>
            <span aria-hidden="true">03 / 03</span>
          </div>
          <p className={styles.resultExplanation}>{result.explanation}</p>
          <p className={styles.resultEvidence}>
            Relevant to: {result.evidenceLabel.toLowerCase()}
          </p>
        </div>
        <div className={styles.resultActions}>
          <Link
            className={styles.primaryAction}
            href={result.destination}
            onClick={onResultClick}
          >
            {result.ctaLabel}
          </Link>
          <button onClick={onChangeAnswers} type="button">
            Change answers
          </button>
        </div>
      </div>
    </section>
  );
}
