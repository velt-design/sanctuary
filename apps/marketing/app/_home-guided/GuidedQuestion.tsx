'use client';

import Image from 'next/image';
import {
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import type {
  GuidedAnswerValue,
  GuidedQuestion as GuidedQuestionModel,
} from './guidedConversationModel';
import type { GuidedMedia } from './guidedConversationMedia';
import styles from './guidedHomepage.module.css';

export type GuidedInputMethod = 'keyboard' | 'pointer';

type GuidedQuestionProps = {
  question: GuidedQuestionModel;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAnswer: (
    answer: GuidedAnswerValue,
    inputMethod: GuidedInputMethod,
  ) => void;
  optionMedia?: Partial<Record<GuidedAnswerValue, GuidedMedia>>;
  presentation?: 'default' | 'hero';
};

export default function GuidedQuestion({
  question,
  headingRef,
  onAnswer,
  optionMedia = {},
  presentation = 'default',
}: GuidedQuestionProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const headingId = `guided-question-${question.id}`;
  const guidanceId = `${headingId}-guidance`;
  const isHeroQuestion = presentation === 'hero';

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const lastIndex = question.options.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = index === lastIndex ? 0 : index + 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = index === 0 ? lastIndex : index - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = lastIndex;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    onAnswer(question.options[nextIndex].value, 'keyboard');
  };

  const handleClick = (
    event: MouseEvent<HTMLButtonElement>,
    answer: GuidedAnswerValue,
  ) => {
    onAnswer(answer, event.detail === 0 ? 'keyboard' : 'pointer');
  };

  return (
    <section
      className={`${styles.question} ${isHeroQuestion ? styles.heroQuestion : ''}`}
      aria-labelledby={headingId}
      data-guided-question={question.id}
      data-guided-treatment={question.treatment}
    >
      {isHeroQuestion ? (
        <div className={styles.heroQuestionHeader}>
          <p id={headingId}>{question.title}</p>
          <span aria-hidden="true">01 / 03</span>
        </div>
      ) : (
        <div className={styles.questionHeader}>
          <p className={styles.eyebrow}>{question.eyebrow}</p>
          <div className={styles.questionTitleRow}>
            <h2 id={headingId} ref={headingRef} tabIndex={-1}>
              {question.title}
            </h2>
            <span aria-hidden="true">
              {String(question.step).padStart(2, '0')} / 03
            </span>
          </div>
          <p className={styles.guidance} id={guidanceId}>
            Choose the closest starting point. You can change it later.
          </p>
        </div>
      )}

      <fieldset
        className={styles.fieldset}
        role="radiogroup"
        aria-labelledby={headingId}
        aria-describedby={isHeroQuestion ? 'guided-home-support' : guidanceId}
      >
        <legend className="visually-hidden">{question.title}</legend>
        <div className={styles.options}>
          {question.options.map((option, index) => {
            const media = question.treatment === 'image-led'
              ? optionMedia[option.value]
              : undefined;
            return (
              <button
              aria-checked="false"
              aria-describedby={`${headingId}-option-${index}`}
              className={`${styles.option} ${media ? styles.imageOption : ''}`}
              data-guided-answer={option.value}
              key={option.value}
              onClick={(event) => handleClick(event, option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              role="radio"
              tabIndex={index === 0 ? 0 : -1}
              type="button"
            >
              {media ? (
                <span className={styles.optionMedia}>
                  <Image
                    alt={media.alt}
                    fill
                    sizes="(max-width: 900px) calc(100vw - 3rem), 31vw"
                    src={media.src}
                    style={{ objectPosition: media.objectPosition }}
                  />
                </span>
              ) : null}
              <span className={styles.optionNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={styles.optionCopy}>
                <strong>{option.label}</strong>
                <span id={`${headingId}-option-${index}`}>
                  {option.description}
                </span>
              </span>
              <span className={styles.optionAction} aria-hidden="true">
                Choose
              </span>
            </button>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
