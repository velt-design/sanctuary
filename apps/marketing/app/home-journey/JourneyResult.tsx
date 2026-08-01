'use client';

import Image from 'next/image';
import type { RefObject } from 'react';
import { Button } from '@/components/marketing-foundation';
import type { JourneyResult as JourneyResultModel } from './journey';
import styles from './homeJourney.module.css';

type JourneyResultProps = {
  result: JourneyResultModel;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export default function JourneyResult({
  result,
  headingRef,
}: JourneyResultProps) {
  return (
    <section
      className={styles.resultStage}
      aria-labelledby={`${result.id}-heading`}
      data-result-id={result.id}
    >
      <figure className={styles.resultHero}>
        <span className={styles.resultHeroMedia}>
          <Image
            src={result.hero.src}
            alt={result.hero.alt}
            fill
            loading="eager"
            quality={75}
            sizes="(max-width: 900px) 100vw, 58vw"
            style={{
              objectFit: 'cover',
              objectPosition: result.hero.objectPosition,
            }}
          />
        </span>
      </figure>

      <div className={styles.resultContent}>
        <div className={styles.resultIntroduction}>
          <p className={styles.eyebrow}>{result.eyebrow}</p>
          <h1
            className={styles.resultHeading}
            id={`${result.id}-heading`}
            ref={headingRef}
            tabIndex={-1}
          >
            {result.title}
          </h1>
          <p className={styles.resultSummary}>{result.summary}</p>
        </div>

        <ul className={styles.considerations}>
          {result.considerations.map((consideration, index) => (
            <li key={consideration}>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              {consideration}
            </li>
          ))}
        </ul>

        <div className={styles.projectReferences}>
          <p className={styles.projectReferencesLabel}>Built references</p>
          <div className={styles.projectReferenceGrid}>
            {result.projects.map((project) => (
              <figure className={styles.projectReference} key={project.slug}>
                <span className={styles.projectReferenceImage}>
                  <Image
                    src={project.image.src}
                    alt={project.image.alt}
                    fill
                    quality={70}
                    sizes="(max-width: 600px) 44vw, (max-width: 900px) 34vw, 15vw"
                    style={{
                      objectFit: 'cover',
                      objectPosition: project.image.objectPosition,
                    }}
                  />
                </span>
                <figcaption>
                  <strong>{project.title}</strong>
                  <span>{project.location}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <Button
          className={styles.resultAction}
          data-home-journey-event="home_journey_enquiry_click"
          data-result-id={result.id}
          href={result.enquiryHref}
        >
          {result.action}
        </Button>
      </div>
    </section>
  );
}
