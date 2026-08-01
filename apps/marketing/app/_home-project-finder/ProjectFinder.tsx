'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useConsent } from '@/components/ConsentProvider';
import {
  Container,
} from '../../components/marketing-foundation/Primitives';
import { buildEnquiryHref } from '../../lib/enquiryContext';
import {
  PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
  PROJECT_FINDER_HOME_PATH,
  projectDirections,
  type ProjectDirection,
  type ProjectPriority,
} from '../../lib/projectFinderContract';
import BriefSummary from './BriefSummary';
import BuildBrief from './BuildBrief';
import ProjectFinderResult from './ProjectFinderResult';
import { projectDirectionContent } from './projectFinderContent';
import type { ProjectFinderHomepageMedia } from './projectFinderMedia';
import {
  buildProjectFinderHref,
  parseProjectFinderState,
  selectProjectDirection,
  updateProjectPriority,
  type ProjectFinderState,
} from './projectFinderModel';
import { pushProjectFinderEvent } from './ProjectFinderTracker';
import styles from './projectFinderHomepage.module.css';

type ProjectFinderProps = {
  initialState: ProjectFinderState;
  media: ProjectFinderHomepageMedia;
};

type InputMethod = 'keyboard' | 'pointer';

function currentHistoryState(): Record<string, unknown> {
  return typeof window.history.state === 'object' && window.history.state
    ? window.history.state as Record<string, unknown>
    : {};
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ProjectFinder({
  initialState,
  media,
}: ProjectFinderProps) {
  const { consent } = useConsent();
  const [state, setState] = useState(initialState);
  const [briefOpen, setBriefOpen] = useState(Boolean(initialState.priorities?.length));
  const [limitMessage, setLimitMessage] = useState('');
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const briefHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstPriorityRef = useRef<HTMLInputElement>(null);
  const didMountRef = useRef(false);
  const transitionMethodRef = useRef<InputMethod | 'history'>('history');
  const lastResultViewRef = useRef<string | null>(null);
  const lastBriefViewRef = useRef<string | null>(null);
  const priorities = state.priorities ?? [];

  const track = (event: string, properties: Record<string, unknown> = {}) => {
    if (!consent.analytics) return;
    pushProjectFinderEvent(event, properties);
  };

  useEffect(() => {
    const canonicalHref = buildProjectFinderHref(initialState);
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref !== canonicalHref) {
      window.history.replaceState(
        { ...currentHistoryState(), projectFinderHome: true },
        '',
        canonicalHref,
      );
    }

    const handlePopState = () => {
      transitionMethodRef.current = 'history';
      const nextState = parseProjectFinderState(
        new URLSearchParams(window.location.search),
      );
      setState(nextState);
      setBriefOpen(Boolean(nextState.priorities?.length));
      setLimitMessage('');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [initialState]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!state.project || transitionMethodRef.current === 'history') return;

    const frame = window.requestAnimationFrame(() => {
      if (transitionMethodRef.current === 'keyboard') {
        resultHeadingRef.current?.focus({ preventScroll: false });
      } else if (typeof resultRef.current?.scrollIntoView === 'function') {
        resultRef.current.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.project]);

  useEffect(() => {
    if (!state.project || !consent.analytics) return;
    const key = `${state.project}:${priorities.join(',')}`;
    if (lastResultViewRef.current === key) return;
    lastResultViewRef.current = key;
    pushProjectFinderEvent('project_result_view', {
      project_direction: state.project,
      ...(priorities.length ? { project_priorities: priorities } : {}),
      source_component: 'project_finder',
      step_number: 2,
    });
  }, [consent.analytics, priorities, state.project]);

  useEffect(() => {
    if (!briefOpen || !state.project || !consent.analytics) return;
    const key = `${state.project}:${priorities.join(',')}`;
    if (lastBriefViewRef.current === key) return;
    lastBriefViewRef.current = key;
    pushProjectFinderEvent('brief_summary_view', {
      project_direction: state.project,
      project_priorities: priorities,
      source_component: 'brief_summary',
      step_number: 3,
    });
  }, [briefOpen, consent.analytics, priorities, state.project]);

  const commitState = (
    nextState: ProjectFinderState,
    method: InputMethod | 'history',
  ) => {
    transitionMethodRef.current = method;
    window.history.pushState(
      { ...currentHistoryState(), projectFinderHome: true },
      '',
      buildProjectFinderHref(nextState),
    );
    setState(nextState);
  };

  const chooseDirection = (
    direction: ProjectDirection,
    method: InputMethod,
  ) => {
    const previousDirection = state.project;
    if (previousDirection === direction) return;
    const nextState = selectProjectDirection(state, direction);
    track(previousDirection ? 'project_direction_change' : 'project_direction_select', {
      project_direction: direction,
      ...(previousDirection ? { previous_project_direction: previousDirection } : {}),
      source_component: 'project_finder',
      step_number: 1,
    });
    setLimitMessage('');
    commitState(nextState, method);
  };

  const handleDirectionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    const lastIndex = projectDirections.length - 1;
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
    chooseDirection(projectDirections[nextIndex], 'keyboard');
  };

  const handleDirectionClick = (
    event: MouseEvent<HTMLButtonElement>,
    direction: ProjectDirection,
  ) => {
    chooseDirection(direction, event.detail === 0 ? 'keyboard' : 'pointer');
  };

  const openBrief = () => {
    setBriefOpen(true);
    track('brief_builder_open', {
      project_direction: state.project,
      ...(priorities.length ? { project_priorities: priorities } : {}),
      source_component: 'project_finder',
      step_number: 3,
    });
    window.requestAnimationFrame(() => briefHeadingRef.current?.focus());
  };

  const changePriority = (priority: ProjectPriority, selected: boolean) => {
    const update = updateProjectPriority(state, priority, selected);
    if (update.limitReached) {
      setLimitMessage('Choose up to three priorities. Remove one before adding another.');
      return;
    }
    setLimitMessage('');
    track(selected ? 'brief_priority_select' : 'brief_priority_remove', {
      project_direction: state.project,
      project_priorities: update.state.priorities ?? [],
      priority,
      source_component: 'brief_summary',
      step_number: 3,
    });
    commitState(update.state, 'pointer');
  };

  const clearPriorities = () => {
    if (!state.project || !priorities.length) return;
    for (const priority of priorities) {
      track('brief_priority_remove', {
        project_direction: state.project,
        priority,
        source_component: 'brief_summary',
        step_number: 3,
      });
    }
    setLimitMessage('');
    commitState({ project: state.project }, 'pointer');
    window.requestAnimationFrame(() => firstPriorityRef.current?.focus());
  };

  const reset = () => {
    setBriefOpen(false);
    setLimitMessage('');
    commitState({}, 'history');
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(
        '[data-project-direction="cover"]',
      )?.focus();
    });
  };

  const directEnquiryHref = buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: PROJECT_FINDER_HOME_PATH,
    sourceComponent: 'project_finder',
    sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
    projectDirection: state.project,
    projectPriorities: priorities,
  });

  return (
    <div data-project-finder-interactive>
      <section
        className={styles.finder}
        id="project-finder"
        aria-labelledby="project-finder-heading"
      >
        <Container width="wide">
          <header className={styles.finderHeader}>
            <p className={styles.eyebrow}>Find your starting point</p>
            <h2 id="project-finder-heading">
              Which project feels closest to what you want to create?
            </h2>
            <p>Choose the closest direction. You can refine it or change it later.</p>
          </header>

          <fieldset
            className={styles.directionFieldset}
            role="radiogroup"
            aria-labelledby="project-finder-heading"
          >
            <legend className="visually-hidden">Choose a project direction</legend>
            <div className={styles.directionGrid}>
              {projectDirections.map((direction, index) => {
                const content = projectDirectionContent[direction];
                const choiceMedia = media.choiceByDirection[direction];
                const selected = state.project === direction;
                return (
                  <button
                    aria-checked={selected}
                    aria-describedby={`project-direction-${direction}-description`}
                    className={styles.directionCard}
                    data-project-direction={direction}
                    data-selected={selected ? 'true' : 'false'}
                    key={direction}
                    onClick={(event) => handleDirectionClick(event, direction)}
                    onKeyDown={(event) => handleDirectionKeyDown(event, index)}
                    role="radio"
                    tabIndex={selected || (!state.project && index === 0) ? 0 : -1}
                    type="button"
                  >
                    <span className={styles.directionImage}>
                      <Image
                        alt={choiceMedia.alt}
                        fill
                        loading="eager"
                        sizes="(max-width: 760px) calc(100vw - 2.5rem), (max-width: 1100px) 33vw, 420px"
                        src={choiceMedia.src}
                        style={{ objectPosition: choiceMedia.objectPosition }}
                      />
                    </span>
                    <span className={styles.directionNumber} aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={styles.directionCopy}>
                      <strong>{content.label}</strong>
                      <span id={`project-direction-${direction}-description`}>
                        {content.description}
                      </span>
                    </span>
                    <span className={styles.directionState} aria-hidden="true">
                      {selected ? 'Selected' : 'Choose'}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </Container>
      </section>

      {state.project ? (
        <>
          <ProjectFinderResult
            direction={state.project}
            headingRef={resultHeadingRef}
            onOpenBrief={openBrief}
            priorities={priorities}
            resultRef={resultRef}
          />

          {briefOpen ? (
            <section className={styles.briefRegion} aria-label="Build your brief">
              <Container width="wide" className={styles.briefLayout}>
                <BuildBrief
                  direction={state.project}
                  firstPriorityRef={firstPriorityRef}
                  headingRef={briefHeadingRef}
                  limitMessage={limitMessage}
                  onChange={changePriority}
                  onClear={clearPriorities}
                  priorities={priorities}
                />
                <BriefSummary
                  direction={state.project}
                  onChangePriorities={() => firstPriorityRef.current?.focus()}
                  priorities={priorities}
                />
              </Container>
            </section>
          ) : null}

          <section
            className={styles.evidence}
            aria-labelledby="project-evidence-heading"
          >
            <Container width="wide">
              <header className={styles.evidenceHeader}>
                <p className={styles.eyebrow}>Relevant built work</p>
                <h2 id="project-evidence-heading">Two useful project references.</h2>
              </header>
              <div className={styles.projectGrid}>
                {media.evidenceByDirection[state.project].map((project) => {
                  const referenceHref = buildEnquiryHref({
                    enquiryType: 'residential',
                    sourcePath: PROJECT_FINDER_HOME_PATH,
                    sourceComponent: 'project_card',
                    sourceProject: project.projectSlug,
                    sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
                    projectDirection: state.project,
                    projectPriorities: priorities,
                  });
                  return (
                    <article
                      className={styles.projectCard}
                      data-project-evidence={project.projectSlug}
                      key={project.projectSlug}
                    >
                      <div className={styles.projectImage}>
                        <Image
                          alt={project.alt}
                          fill
                          loading="lazy"
                          sizes="(max-width: 760px) calc(100vw - 2.5rem), 46vw"
                          src={project.src}
                          style={{ objectPosition: project.objectPosition }}
                        />
                      </div>
                      <div className={styles.projectCardContent}>
                        <p className={styles.projectLocation}>{project.location}</p>
                        <h3>{project.projectTitle}</h3>
                        <p>{project.reason}</p>
                        <div className={styles.projectActions}>
                          <Link
                            data-project-finder-event="project_reference_click"
                            data-project-direction={state.project}
                            data-project-priorities={priorities.join(',')}
                            data-selected-project={project.projectSlug}
                            data-source-component="project_card"
                            href={`/projects/${project.projectSlug}`}
                          >
                            View project
                          </Link>
                          <Link
                            data-project-finder-event="project_reference_click"
                            data-project-direction={state.project}
                            data-project-priorities={priorities.join(',')}
                            data-selected-project={project.projectSlug}
                            data-source-component="project_card"
                            href={referenceHref}
                          >
                            Use as a reference
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </Container>
          </section>
        </>
      ) : null}

      <section className={styles.close} aria-labelledby="project-finder-close-heading">
        <Container className={styles.closeLayout} width="wide">
          <div>
            <p className={styles.eyebrow}>Start a conversation</p>
            <h2 id="project-finder-close-heading">
              {state.project
                ? `Ready to discuss ${projectDirectionContent[state.project].label.toLowerCase()}?`
                : 'Not sure which direction fits?'}
            </h2>
            <p>
              {state.project
                ? `Send the direction${priorities.length ? ' and priorities' : ''} you have selected so Sanctuary can review the site and next steps.`
                : 'Sanctuary can review the site, intended use and the relationship to the house before the design direction is fixed.'}
            </p>
          </div>
          <div className={styles.closeActions}>
            <Link
              className={styles.closePrimaryAction}
              data-project-finder-event="project_finder_direct_enquiry_click"
              data-project-direction={state.project}
              data-project-priorities={priorities.join(',')}
              data-source-component="project_finder"
              href={directEnquiryHref}
            >
              {state.project ? 'Send your brief' : 'Start your project'}
            </Link>
            {state.project ? (
              <a href="tel:+64228545633">Call Sanctuary</a>
            ) : null}
            {state.project ? (
              <button className={styles.reset} onClick={reset} type="button">
                Start again
              </button>
            ) : null}
          </div>
        </Container>
      </section>

      <p
        className="visually-hidden"
        role="status"
        aria-atomic="true"
        aria-live="polite"
      >
        {state.project
          ? `${projectDirectionContent[state.project].label} selected. ${priorities.length} priorities selected.`
          : 'No project direction selected.'}
      </p>
    </div>
  );
}
