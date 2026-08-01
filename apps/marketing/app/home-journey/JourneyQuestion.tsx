'use client';

import Image from 'next/image';
import type { RefObject } from 'react';
import type {
  JourneyAnswer,
  JourneyQuestion as JourneyQuestionModel,
} from './journey';
import styles from './homeJourney.module.css';

type JourneyQuestionProps = {
  question: JourneyQuestionModel;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAnswer: (answer: JourneyAnswer) => void;
};

export default function JourneyQuestion({
  question,
  headingRef,
  onAnswer,
}: JourneyQuestionProps) {
  return (
    <section
      className={styles.questionStage}
      aria-labelledby={`${question.id}-heading`}
      data-question-id={question.id}
    >
      <div className={styles.questionCopy}>
        <p className={styles.eyebrow}>{question.eyebrow}</p>
        <h1
          className={styles.questionHeading}
          id={`${question.id}-heading`}
          ref={headingRef}
          tabIndex={-1}
        >
          {question.question}
        </h1>
        <p className={styles.guidance}>{question.guidance}</p>
      </div>

      <fieldset className={styles.choiceFieldset}>
        <legend className="visually-hidden">{question.question}</legend>
        <div
          className={styles.choices}
          data-choice-count={question.options.length}
          data-presentation={question.presentation}
        >
          {question.options.map((option, index) => (
            <button
              className={styles.choice}
              data-answer-id={option.value}
              data-home-journey-event="home_journey_answer_select"
              data-question-id={question.id}
              data-step-number={question.step}
              key={option.value}
              onClick={() => onAnswer(option.value)}
              type="button"
            >
              {option.image ? (
                <span className={styles.choiceMedia} aria-hidden="true">
                  <Image
                    src={option.image.src}
                    alt=""
                    fill
                    priority={question.id === 'audience'}
                    quality={75}
                    sizes="(max-width: 760px) 100vw, (max-width: 1180px) 48vw, 32vw"
                    style={{
                      objectFit: 'cover',
                      objectPosition: option.image.objectPosition,
                    }}
                  />
                </span>
              ) : null}
              <span className={styles.choiceShade} aria-hidden="true" />
              <span className={styles.choiceNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={styles.choiceBody}>
                <span className={styles.choiceLabel}>{option.label}</span>
                <span className={styles.choiceDetail}>{option.detail}</span>
              </span>
              <span className={styles.choiceArrow} aria-hidden="true">
                &rarr;
              </span>
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

