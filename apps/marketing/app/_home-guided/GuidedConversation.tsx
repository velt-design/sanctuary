'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { Container } from '../../components/marketing-foundation/Primitives';
import GuidedHero from './GuidedHero';
import GuidedQuestion, { type GuidedInputMethod } from './GuidedQuestion';
import GuidedResult from './GuidedResult';
import { useGuidedHomepageTracker } from './GuidedHomepageTracker';
import {
  getGuidedResultMedia,
  type GuidedHomepageMedia,
} from './guidedConversationMedia';
import {
  answerGuidedQuestion,
  buildGuidedHomeHref,
  changeGuidedAnswer,
  getGuidedProgress,
  getGuidedQuestion,
  getGuidedScreen,
  getGuidedSummaryItems,
  parseGuidedConversationState,
  type GuidedAnswerValue,
  type GuidedConversationState,
  type GuidedQuestionId,
  type GuidedSummaryItem,
} from './guidedConversationModel';
import styles from './guidedHomepage.module.css';

type GuidedConversationProps = {
  initialState: GuidedConversationState;
  media: GuidedHomepageMedia;
};

type TransitionReason = GuidedInputMethod | 'change' | 'history' | 'reset';

function currentHistoryState(): Record<string, unknown> {
  return typeof window.history.state === 'object' && window.history.state
    ? window.history.state as Record<string, unknown>
    : {};
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function GuidedConversation({
  initialState,
  media,
}: GuidedConversationProps) {
  const [state, setState] = useState(initialState);
  const heroHeadingRef = useRef<HTMLHeadingElement>(null);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  const transitionReasonRef = useRef<TransitionReason>('history');
  const screen = getGuidedScreen(state);
  const summaries = getGuidedSummaryItems(state);
  const progress = getGuidedProgress(state);
  const screenKey = screen.kind === 'question'
    ? `question-${screen.id}`
    : `result-${screen.result.id}`;
  const {
    trackAnswer,
    trackChangeAnswer,
    trackReset,
    trackResultClick,
  } = useGuidedHomepageTracker({ state, screen });

  useEffect(() => {
    const canonicalHref = buildGuidedHomeHref(initialState);
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref !== canonicalHref) {
      window.history.replaceState(
        { ...currentHistoryState(), guidedHome: true },
        '',
        canonicalHref,
      );
    }

    const handlePopState = () => {
      transitionReasonRef.current = 'history';
      setState(parseGuidedConversationState(
        new URLSearchParams(window.location.search),
      ));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [initialState]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const transitionReason = transitionReasonRef.current;
    const frame = window.requestAnimationFrame(() => {
      if (transitionReason === 'keyboard' || transitionReason === 'change') {
        if (screen.kind === 'question' && screen.id === 'audience') {
          heroHeadingRef.current?.focus({ preventScroll: false });
        } else {
          stageHeadingRef.current?.focus({ preventScroll: false });
        }
        return;
      }
      if (
        transitionReason === 'pointer'
        && typeof stageRef.current?.scrollIntoView === 'function'
      ) {
        stageRef.current.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [screenKey]);

  const commitState = (
    nextState: GuidedConversationState,
    reason: TransitionReason,
  ) => {
    transitionReasonRef.current = reason;
    window.history.pushState(
      { ...currentHistoryState(), guidedHome: true },
      '',
      buildGuidedHomeHref(nextState),
    );
    setState(nextState);
  };

  const answerQuestion = (
    questionId: GuidedQuestionId,
    answer: GuidedAnswerValue,
    inputMethod: GuidedInputMethod,
  ) => {
    const nextState = answerGuidedQuestion(state, questionId, answer);
    if (nextState === state) return;
    trackAnswer(questionId, answer, nextState);
    commitState(nextState, inputMethod);
  };

  const changeAnswer = (item: GuidedSummaryItem) => {
    const nextState = changeGuidedAnswer(state, item.questionId);
    trackChangeAnswer(item);
    commitState(nextState, 'change');
  };

  const reset = () => {
    trackReset();
    commitState({}, 'reset');
  };

  const announcement = screen.kind === 'question'
    ? `Question ${progress.current} of 3. ${getGuidedQuestion(screen.id).title}`
    : `Your best starting point is ${screen.result.title}.`;

  return (
    <div
      className={`${styles.conversation} ${styles.interactive}`}
      data-guided-home-screen={screenKey}
      data-guided-home-variant="guided_design_conversation_home_v1"
    >
      <div
        ref={screen.kind === 'question' && screen.id === 'audience'
          ? stageRef
          : undefined}
      >
        <GuidedHero
          audienceQuestion={screen.kind === 'question' && screen.id === 'audience'
            ? getGuidedQuestion('audience')
            : undefined}
          headingRef={heroHeadingRef}
          media={media}
          onAnswer={(answer, inputMethod) => (
            answerQuestion('audience', answer, inputMethod)
          )}
        />
      </div>

      {screen.kind !== 'question' || screen.id !== 'audience' ? (
        <section
          className={styles.journey}
          id="design-conversation"
          aria-label="Guided project matcher"
        >
          <Container className={styles.journeyContent} width="wide">
            {summaries.length ? (
              <div className={styles.summaryRegion} aria-label="Your selected answers">
                <ol className={styles.summaries}>
                  {summaries.map((item) => (
                    <li key={item.questionId}>
                      <span aria-hidden="true">
                        {String(item.step).padStart(2, '0')}
                      </span>
                      <strong>{item.answerLabel}</strong>
                      <button
                        aria-label={`Change answer to question ${item.step}: ${item.questionTitle}`}
                        onClick={() => changeAnswer(item)}
                        type="button"
                      >
                        Change
                      </button>
                    </li>
                  ))}
                </ol>
                <button className={styles.reset} onClick={reset} type="button">
                  Start again
                </button>
              </div>
            ) : null}

            <div className={styles.stage} key={screenKey} ref={stageRef}>
              {screen.kind === 'question' ? (
                <GuidedQuestion
                  headingRef={stageHeadingRef}
                  onAnswer={(answer, inputMethod) => (
                    answerQuestion(screen.id, answer, inputMethod)
                  )}
                  optionMedia={media.optionByAnswer}
                  question={getGuidedQuestion(screen.id)}
                />
              ) : (
                <GuidedResult
                  headingRef={stageHeadingRef}
                  media={getGuidedResultMedia(media, screen.result.id, state)}
                  onChangeAnswers={() => {
                    const finalAnswer = summaries.at(-1);
                    if (finalAnswer) changeAnswer(finalAnswer);
                  }}
                  onResultClick={() => trackResultClick(screen.result)}
                  result={screen.result}
                />
              )}
            </div>
          </Container>
        </section>
      ) : null}

      <aside className={styles.reassurance} aria-label="About Sanctuary">
        <Container width="wide">
          <p>Designed and built in Auckland</p>
          <p>Fixed-roof pergola specialists</p>
          <p>Residential, commercial and consultant-led work</p>
        </Container>
      </aside>

      <p
        className="visually-hidden"
        role="status"
        aria-atomic="true"
        aria-live="polite"
      >
        {announcement}
      </p>
    </div>
  );
}
