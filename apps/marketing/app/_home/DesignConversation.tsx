'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  HOME_INTENT_STORAGE_KEY,
  HOME_PATH,
  isProjectIntent,
  type IntentResponse,
  type ProjectIntent,
} from './matching';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import styles from './homepage.module.css';

type DesignConversationProps = {
  responses: IntentResponse[];
};

export default function DesignConversation({
  responses,
}: DesignConversationProps) {
  const [selectedIntent, setSelectedIntent] = useState<ProjectIntent | null>(
    null,
  );
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    try {
      const storedIntent = window.sessionStorage.getItem(
        HOME_INTENT_STORAGE_KEY,
      );
      if (isProjectIntent(storedIntent)) setSelectedIntent(storedIntent);
    } catch {
      // The conversation remains fully usable when storage is unavailable.
    }
  }, []);

  const selectedResponse = responses.find(
    (response) => response.value === selectedIntent,
  );
  const matchedProjectSlugs = selectedResponse?.projects
    .map((project) => project.slug)
    .join(',');

  const selectIntent = (intent: ProjectIntent) => {
    setSelectedIntent(intent);
    try {
      window.sessionStorage.setItem(
        HOME_INTENT_STORAGE_KEY,
        intent,
      );
    } catch {
      // Persistence is optional; the active page state is authoritative.
    }
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const lastIndex = responses.length - 1;
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
    const nextResponse = responses[nextIndex];
    if (!nextResponse) return;
    selectIntent(nextResponse.value);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className={styles.conversation}
      data-design-conversation-interactive
    >
      <fieldset
        className={styles.questionGroup}
        role="radiogroup"
        aria-labelledby="intent-question-legend"
        aria-describedby="intent-question-guidance"
      >
        <legend className={styles.questionLegend} id="intent-question-legend">
          What are you trying to create?
        </legend>
        <p className={styles.questionGuidance} id="intent-question-guidance">
          Choose the closest starting point. This changes the built work shown
          below, not a design recommendation.
        </p>
        <div className={styles.intentOptions}>
          {responses.map((response, index) => {
            const isSelected = response.value === selectedIntent;
            const isTabStop = selectedIntent
              ? isSelected
              : index === 0;

            return (
              <button
                className={styles.intentOption}
                data-design-conversation-event={
                  isSelected
                    ? undefined
                    : 'design_conversation_intent_select'
                }
                data-enquiry-type={response.enquiryType}
                data-matched-projects={response.projects
                  .map((project) => project.slug)
                  .join(',')}
                data-project-intent={response.value}
                data-selected={isSelected ? 'true' : undefined}
                data-step-number="1"
                key={response.value}
                onClick={() => selectIntent(response.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                role="radio"
                aria-checked={isSelected}
                tabIndex={isTabStop ? 0 : -1}
                type="button"
              >
                <span className={styles.optionNumber} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={styles.optionLabel}>{response.label}</span>
                <span className={styles.optionState}>
                  {isSelected ? 'Selected' : 'Choose'}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <p
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectedResponse
          ? `Showing two built examples for ${selectedResponse.summaryLabel}.`
          : ''}
      </p>

      {selectedResponse ? (
        <section
          className={styles.response}
          aria-labelledby="homepage-response-heading"
          data-intent-response={selectedResponse.value}
        >
          <div className={styles.selectedSummary}>
            <span>Project context</span>
            <strong>{selectedResponse.summaryLabel}</strong>
            <button
              type="button"
              onClick={() => {
                setSelectedIntent(null);
                try {
                  window.sessionStorage.removeItem(
                    HOME_INTENT_STORAGE_KEY,
                  );
                } catch {
                  // Resetting the visible state does not depend on storage.
                }
                optionRefs.current[0]?.focus();
              }}
            >
              Change
            </button>
          </div>

          <div className={styles.responseHeader}>
            <div>
              <p className={styles.responseEyebrow}>Relevant built examples</p>
              <h2 id="homepage-response-heading">
                Two built projects to begin the conversation
              </h2>
            </div>
            <p>{selectedResponse.statement}</p>
          </div>

          <div className={styles.projectGrid}>
            {selectedResponse.projects.map((project, index) => (
              <article className={styles.projectCard} key={project.slug}>
                <figure className={styles.projectFigure}>
                  <Image
                    src={project.image.src}
                    alt={project.image.alt}
                    fill
                    quality={75}
                    sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 42vw"
                    style={{
                      objectFit: 'cover',
                      objectPosition: project.image.objectPosition,
                    }}
                  />
                </figure>
                <div className={styles.projectBody}>
                  <p className={styles.projectIndex}>
                    Built example / {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3>{project.title}</h3>
                  <ul className={styles.projectMeta}>
                    <li>{project.location}</li>
                    <li>{project.type}</li>
                    <li>{project.roof}</li>
                  </ul>
                  <p className={styles.projectRationale}>
                    {project.rationale}
                  </p>
                  <div className={styles.projectActions}>
                    <Link
                      href={project.projectHref}
                      data-design-conversation-event="design_conversation_project_open"
                      data-matched-projects={matchedProjectSlugs}
                      data-project-intent={selectedResponse.value}
                      data-selected-project={project.slug}
                    >
                      View project
                    </Link>
                    <Link
                      className={styles.referenceAction}
                      href={project.enquiryHref}
                      data-design-conversation-event="design_conversation_reference_select"
                      data-enquiry-type={
                        project.type === 'Commercial'
                          ? 'commercial'
                          : 'residential'
                      }
                      data-matched-projects={matchedProjectSlugs}
                      data-project-intent={selectedResponse.value}
                      data-selected-project={project.slug}
                    >
                      Use as enquiry reference
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className={styles.responseCaveat}>
            These projects share a related project context. Site dimensions,
            exposure, connections and intended use still determine the right
            response.
          </p>

          <div className={styles.escapeActions}>
            <Link href="/projects">Browse all completed projects</Link>
            <Link
              href={selectedResponse.generalEnquiryHref}
              data-design-conversation-event="design_conversation_general_enquiry_click"
              data-enquiry-type={selectedResponse.enquiryType}
              data-matched-projects={matchedProjectSlugs}
              data-project-intent={selectedResponse.value}
            >
              Start a general enquiry
            </Link>
          </div>
        </section>
      ) : (
        <div className={styles.initialEscapeActions}>
          <Link href="/projects">Browse completed projects</Link>
          <Link
            href={buildEnquiryHref({
              sourcePath: HOME_PATH,
              sourceComponent: 'pathway',
            })}
            data-design-conversation-event="design_conversation_general_enquiry_click"
          >
            Start a general enquiry
          </Link>
        </div>
      )}
    </div>
  );
}
