'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MarketingPage } from '@/components/marketing-foundation';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import JourneyQuestion from './JourneyQuestion';
import JourneyResult from './JourneyResult';
import JourneyTracker from './JourneyTracker';
import {
  appendJourneyAnswer,
  getJourneyCompletion,
  getJourneyScreen,
  HOME_JOURNEY_PATH,
  type JourneyAnswer,
  type JourneyModel,
} from './journey';
import styles from './homeJourney.module.css';

type JourneyHomepageProps = {
  model: JourneyModel;
};

function NoScriptJourney({ model }: JourneyHomepageProps) {
  const residentialResults = [
    model.results['insulated-roof'],
    model.results['daylight-roof'],
    model.results['bespoke-acrylic'],
    model.results['timber-lined-room'],
    model.results['mixed-material-room'],
  ];
  const businessResults = [
    model.results['professional-collaboration'],
    model.results['hospitality-cover'],
    model.results['builder-collaboration'],
  ];

  return (
    <noscript>
      <style>{`.${styles.interactive}{display:none!important}`}</style>
      <main className={styles.noScript}>
        <p className={styles.eyebrow}>A guided start</p>
        <h1>Find the closest path for your project.</h1>
        <p>
          JavaScript is unavailable, so every pathway is shown together.
        </p>
        <div className={styles.noScriptColumns}>
          <section>
            <h2>For your home</h2>
            <ul>
              {residentialResults.map((result) => (
                <li key={result.id}>
                  <strong>{result.eyebrow.replace('Your direction / ', '')}</strong>
                  <span>{result.summary}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>For a business or project</h2>
            <ul>
              {businessResults.map((result) => (
                <li key={result.id}>
                  <strong>{result.eyebrow.replace('Your direction / ', '')}</strong>
                  <span>{result.summary}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <Link
          href={buildEnquiryHref({
            sourcePath: HOME_JOURNEY_PATH,
            sourceComponent: 'pathway',
          })}
        >
          Start a conversation
        </Link>
      </main>
    </noscript>
  );
}

export default function JourneyHomepage({ model }: JourneyHomepageProps) {
  const [answers, setAnswers] = useState<JourneyAnswer[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasInteractedRef = useRef(false);
  const screen = getJourneyScreen(answers);
  const completion = getJourneyCompletion(answers);
  const screenKey = `${screen.kind}-${screen.id}`;

  useEffect(() => {
    if (!hasInteractedRef.current) return;
    headingRef.current?.focus({ preventScroll: true });
  }, [screenKey]);

  const answerQuestion = (answer: JourneyAnswer) => {
    hasInteractedRef.current = true;
    setAnswers((current) =>
      appendJourneyAnswer(model, current, answer),
    );
  };

  const goBack = () => {
    hasInteractedRef.current = true;
    setAnswers((current) => current.slice(0, -1));
  };

  return (
    <>
      <MarketingPage
        className={`${styles.page} ${styles.interactive}`}
        data-home-journey
        data-home-journey-screen={screenKey}
      >
        <JourneyTracker />
        <header className={styles.header}>
          <Link className={styles.brand} href="/" aria-label="Sanctuary Pergolas home">
            <span>Sanctuary</span>
            <small>Pergolas</small>
          </Link>

          <div
            className={styles.progress}
            aria-label={screen.kind === 'result'
              ? 'Journey complete'
              : `Question ${completion.current} of ${completion.total}`}
            aria-valuemax={completion.total}
            aria-valuemin={1}
            aria-valuenow={completion.current}
            role="progressbar"
          >
            <span>
              {screen.kind === 'result'
                ? 'Your direction'
                : `${completion.current} / ${completion.total}`}
            </span>
            <i aria-hidden="true">
              <b
                style={{
                  transform: `scaleX(${completion.current / completion.total})`,
                }}
              />
            </i>
          </div>

          {answers.length ? (
            <button
              className={styles.back}
              data-home-journey-event="home_journey_back"
              data-step-number={completion.current}
              onClick={goBack}
              type="button"
            >
              <span aria-hidden="true">&larr;</span>
              Back
            </button>
          ) : (
            <span className={styles.headerLabel}>Find your starting point</span>
          )}
        </header>

        <div className={styles.stage} key={screenKey}>
          {screen.kind === 'question' ? (
            <JourneyQuestion
              headingRef={headingRef}
              onAnswer={answerQuestion}
              question={model.questions[screen.id]}
            />
          ) : (
            <JourneyResult
              headingRef={headingRef}
              result={model.results[screen.id]}
            />
          )}
        </div>
      </MarketingPage>
      <NoScriptJourney model={model} />
    </>
  );
}
