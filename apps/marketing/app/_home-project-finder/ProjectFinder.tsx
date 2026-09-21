'use client';
import HomePergolaSelection from './HomePergolaSelection';

import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useConsent } from '@/components/ConsentProvider';
import { Container } from '../../components/marketing-foundation/Primitives';
import { buildEnquiryHref, type EnquiryAudience } from '../../lib/enquiryContext';
import { buildHomeConfiguratorHref } from '../../lib/configuratorEntry';
import {
  buildProjectFinderHomeDestinationHref,
} from '../../lib/projectFinderContinuation';
import {
  PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
  PROJECT_FINDER_HOME_PATH,
  PROJECT_FINDER_STATE_EVENT,
  commercialProfessionalPathLabels,
  type CommercialProfessionalPath,
  type ProjectFinderHomeDirection,
  type ProjectPriority,
  type ResidentialProjectFinderHomeDirection,
} from '../../lib/projectFinderContract';
import BriefSummary from './BriefSummary';
import BuildBrief from './BuildBrief';
import CommercialProfessionalChooser from './CommercialProfessionalChooser';
import ProjectFinderClose from './ProjectFinderClose';
import {
  commercialProfessionalPathContent,
  projectDirectionContent,
  residentialProjectResultContent,
  type ProjectResultContent,
} from './projectFinderContent';
import ProjectFinderEvidence from './ProjectFinderEvidence';
import type {
  ProjectEvidence,
  ProjectFinderHomepageMedia,
} from './projectFinderMedia';
import {
  buildProjectFinderHref,
  isResidentialProjectFinderState,
  parseProjectFinderState,
  selectCommercialProfessionalPath,
  selectProjectDirection,
  updateProjectPriority,
  type ProjectFinderState,
} from './projectFinderModel';
import ProjectFinderResult from './ProjectFinderResult';
import { pushProjectFinderEvent } from './ProjectFinderTracker';
import styles from './projectFinderHomepage.module.css';

type ProjectFinderProps = {
  initialState: ProjectFinderState;
  media: ProjectFinderHomepageMedia;
};

type InputMethod = 'keyboard' | 'pointer';

type ActiveResult = {
  content: ProjectResultContent;
  direction: ProjectFinderHomeDirection;
  enquiryType: EnquiryAudience;
  key: string;
  pathwayHref: string;
  priorities: ProjectPriority[];
  professionalPath?: CommercialProfessionalPath;
  projects: readonly ProjectEvidence[];
};

function currentHistoryState(): Record<string, unknown> {
  const state = typeof window.history.state === 'object' && window.history.state
    ? { ...window.history.state as Record<string, unknown> }
    : {};
  // Let Next synchronize this public URL change instead of treating it as an
  // internal router write with a stale cached route tree.
  delete state.__NA;
  delete state._N;
  delete state.__PRIVATE_NEXTJS_INTERNALS_TREE;
  return state;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getActiveResult(
  state: ProjectFinderState,
  media: ProjectFinderHomepageMedia,
): ActiveResult | null {
  if (isResidentialProjectFinderState(state)) {
    const priorities = state.priorities ?? [];
    return {
      content: residentialProjectResultContent[state.project],
      direction: state.project,
      enquiryType: 'residential',
      key: state.project,
      pathwayHref: state.project === 'cover' ? buildHomeConfiguratorHref(priorities) : buildProjectFinderHomeDestinationHref({
        direction: state.project,
        priorities,
      }),
      priorities,
      projects: media.evidenceByDirection[state.project],
    };
  }

  if (
    state.project === 'commercial-professional'
    && state.professionalPath
  ) {
    const content = commercialProfessionalPathContent[state.professionalPath];
    return {
      content,
      direction: state.project,
      enquiryType: content.enquiryType,
      key: `commercial-professional:${state.professionalPath}`,
      pathwayHref: buildProjectFinderHomeDestinationHref({
        direction: state.project,
        priorities: [],
        professionalPath: state.professionalPath,
      }),
      priorities: [],
      professionalPath: state.professionalPath,
      projects: media.evidenceByProfessionalPath[state.professionalPath],
    };
  }

  return null;
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
  const professionalHeadingRef = useRef<HTMLHeadingElement>(null);
  const professionalSectionRef = useRef<HTMLElement>(null);
  const briefHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstPriorityRef = useRef<HTMLInputElement>(null);
  const didMountRef = useRef(false);
  const transitionMethodRef = useRef<InputMethod | 'history'>('history');
  const lastResultViewRef = useRef<string | null>(null);
  const lastBriefViewRef = useRef<string | null>(null);
  const activeResult = getActiveResult(state, media);
  const isResidential = isResidentialProjectFinderState(state);
  const priorities = isResidential ? state.priorities ?? [] : [];

  const track = (event: string, properties: Record<string, unknown> = {}) => {
    if (!consent.analytics) return;
    pushProjectFinderEvent(event, properties);
  };

  useEffect(() => {
    // Back can remount cached server props from before the visitor's selection.
    // The current URL owns the restored brief, not those original props.
    const restoredState = parseProjectFinderState(new URLSearchParams(window.location.search));
    setState(restoredState);
    setBriefOpen(Boolean(restoredState.priorities?.length));
    const canonicalHref = buildProjectFinderHref(restoredState);
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
    if (transitionMethodRef.current === 'history') return;

    const frame = window.requestAnimationFrame(() => {
      const showProfessionalChooser =
        state.project === 'commercial-professional'
        && !state.professionalPath;
      const heading = showProfessionalChooser
        ? professionalHeadingRef.current
        : resultHeadingRef.current;
      const section = showProfessionalChooser
        ? professionalSectionRef.current
        : resultRef.current;

      if (transitionMethodRef.current === 'keyboard') {
        heading?.focus({ preventScroll: false });
      } else if (typeof section?.scrollIntoView === 'function') {
        section.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.professionalPath, state.project]);

  useEffect(() => {
    if (!activeResult) {
      lastResultViewRef.current = null;
      return;
    }
    if (!consent.analytics || lastResultViewRef.current === activeResult.key) return;
    lastResultViewRef.current = activeResult.key;
    pushProjectFinderEvent('project_result_view', {
      project_direction: activeResult.direction,
      ...(activeResult.professionalPath
        ? { professional_path: activeResult.professionalPath }
        : {}),
      source_component: 'project_finder',
      step_number: activeResult.professionalPath ? 3 : 2,
    });
  }, [activeResult, consent.analytics]);

  useEffect(() => {
    if (!briefOpen || !isResidential || !consent.analytics) return;
    const key = `${state.project}:${priorities.join(',')}`;
    if (lastBriefViewRef.current === key) return;
    lastBriefViewRef.current = key;
    pushProjectFinderEvent('brief_summary_view', {
      project_direction: state.project,
      project_priorities: priorities,
      source_component: 'brief_summary',
      step_number: 3,
    });
  }, [briefOpen, consent.analytics, isResidential, priorities, state.project]);

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
    window.dispatchEvent(new Event(PROJECT_FINDER_STATE_EVENT));
    setState(nextState);
  };

  const chooseDirection = (
    direction: ProjectFinderHomeDirection,
    method: InputMethod,
  ) => {
    const previousDirection = state.project;
    if (previousDirection === direction) return;
    const nextState = selectProjectDirection(state, direction);
    track(
      previousDirection ? 'project_direction_change' : 'project_direction_select',
      {
        project_direction: direction,
        ...(previousDirection
          ? { previous_project_direction: previousDirection }
          : {}),
        source_component: 'project_finder',
        step_number: 1,
      },
    );
    if (direction === 'commercial-professional') setBriefOpen(false);
    setLimitMessage('');
    commitState(nextState, method);
  };

  const chooseProfessionalPath = (
    professionalPath: CommercialProfessionalPath,
    method: InputMethod,
  ) => {
    const previousPath = state.professionalPath;
    if (previousPath === professionalPath) return;
    const nextState = selectCommercialProfessionalPath(state, professionalPath);
    track(previousPath ? 'professional_path_change' : 'professional_path_select', {
      project_direction: 'commercial-professional',
      professional_path: professionalPath,
      ...(previousPath ? { previous_professional_path: previousPath } : {}),
      source_component: 'project_finder',
      step_number: 2,
    });
    commitState(nextState, method);
  };

  const openBrief = () => {
    if (!isResidential) return;
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
      setLimitMessage(
        'Choose up to three priorities. Remove one before adding another.',
      );
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
    if (!isResidential || !priorities.length) return;
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
      document.querySelector<HTMLAnchorElement>(
        '#project-finder-opening a',
      )?.focus();
    });
  };

  const directEnquiryHref = activeResult
    ? buildEnquiryHref({
        enquiryType: activeResult.enquiryType,
        sourcePath: PROJECT_FINDER_HOME_PATH,
        sourceComponent: 'project_finder',
        sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
        projectDirection: activeResult.direction,
        projectProfessionalPath: activeResult.professionalPath,
        projectPriorities: activeResult.priorities,
      })
    : null;

  return (
    <div data-project-finder-interactive>
      <HomePergolaSelection onSelect={chooseDirection} selected={state.project}/>

      {state.project === 'commercial-professional' ? (
        <CommercialProfessionalChooser
          headingRef={professionalHeadingRef}
          media={media.choiceByProfessionalPath}
          onSelect={chooseProfessionalPath}
          sectionRef={professionalSectionRef}
          selectedPath={state.professionalPath}
        />
      ) : null}

      {!state.project ? (
        <ProjectFinderEvidence
          priorities={[]}
          projects={[media.evidenceByDirection.cover[0], media.evidenceByDirection.bespoke[0]]}
        />
      ) : null}

      {activeResult ? (
        <>
          <ProjectFinderResult
            content={activeResult.content}
            direction={activeResult.direction}
            headingRef={resultHeadingRef}
            onOpenBrief={isResidential ? openBrief : undefined}
            pathwayHref={activeResult.pathwayHref}
            priorities={activeResult.priorities}
            professionalPath={activeResult.professionalPath}
            resultKey={activeResult.key}
            resultRef={resultRef}
          />

          {briefOpen && isResidential ? (
            <section className={styles.briefRegion} aria-label="Build your brief">
              <Container width="wide" className={styles.briefLayout}>
                <BuildBrief
                  direction={state.project as ResidentialProjectFinderHomeDirection}
                  firstPriorityRef={firstPriorityRef}
                  headingRef={briefHeadingRef}
                  limitMessage={limitMessage}
                  onChange={changePriority}
                  onClear={clearPriorities}
                  priorities={priorities}
                />
                <BriefSummary
                  direction={state.project as ResidentialProjectFinderHomeDirection}
                  onChangePriorities={() => firstPriorityRef.current?.focus()}
                  pathwayHref={activeResult.pathwayHref}
                  priorities={priorities}
                />
              </Container>
            </section>
          ) : null}

          <ProjectFinderEvidence
            direction={activeResult.direction}
            priorities={activeResult.priorities}
            professionalPath={activeResult.professionalPath}
            projects={activeResult.projects}
          />

          {directEnquiryHref ? (
            <ProjectFinderClose
              content={activeResult.content}
              direction={activeResult.direction}
              enquiryHref={directEnquiryHref}
              onReset={reset}
              priorities={activeResult.priorities}
              professionalPath={activeResult.professionalPath}
            />
          ) : null}
        </>
      ) : null}

      <p
        className="visually-hidden"
        role="status"
        aria-atomic="true"
        aria-live="polite"
      >
        {activeResult?.professionalPath
          ? `${commercialProfessionalPathLabels[activeResult.professionalPath]} selected.`
          : activeResult
            ? `${projectDirectionContent[activeResult.direction].label} selected. ${priorities.length} priorities selected.`
            : state.project === 'commercial-professional'
              ? 'Commercial / Professional selected. Choose the closest project pathway.'
              : 'No project direction selected.'}
      </p>
    </div>
  );
}
