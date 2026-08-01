'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import JsonLd from '@/components/JsonLd';
import type { Project } from '@/data/projects';
import {
  buildProjectDetailHistoryState,
  captureProjectSwitchAnchor,
  getProjectDetailSlug,
  getProjectHeroPreloadUrl,
  restoreProjectSwitchAnchor,
  shouldPreserveProjectDetailScroll,
  shouldUseInPlaceProjectNavigation,
  type ProjectSwitchAnchor,
} from '@/lib/projectDetailNavigation';
import type { ProjectCollectionItem } from './projectCollection';
import ProjectDetailContent from './ProjectDetailContent';
import ProjectNavigator from './ProjectNavigator';
import ProjectRuntimeMetadata from './ProjectRuntimeMetadata';
import {
  buildProjectStructuredData,
  getProjectCaseStudyHero,
} from './projectSeo';

type ProjectSelection = {
  project: Project;
  projectIndex: number;
  relatedProjects: Project[];
};

type ProjectDetailExperienceProps = {
  initialProject: Project;
  initialProjectIndex: number;
  initialRelatedProjects: Project[];
  projects: ProjectCollectionItem[];
};

let projectRecordsPromise: Promise<Project[]> | null = null;

function loadProjectRecords(): Promise<Project[]> {
  projectRecordsPromise ??= import('@/data/projects')
    .then(({ projects }) => projects);
  return projectRecordsPromise;
}

function resolveSelection(
  projectRecords: Project[],
  slug: string,
): ProjectSelection | null {
  const projectIndex = projectRecords.findIndex((project) => project.slug === slug);
  const project = projectRecords[projectIndex];
  if (!project) return null;

  return {
    project,
    projectIndex,
    relatedProjects: (project.related ?? [])
      .map((relatedSlug) => projectRecords.find(
        (candidate) => candidate.slug === relatedSlug,
      ))
      .filter((candidate): candidate is Project => Boolean(candidate)),
  };
}

async function decodeImage(source: string): Promise<void> {
  const image = new window.Image();
  image.decoding = 'async';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Unable to preload ${source}`));
    image.src = source;
    if (image.complete) {
      if (image.naturalWidth > 0) resolve();
      else reject(new Error(`Unable to preload ${source}`));
    }
  });

  if (typeof image.decode === 'function') {
    await image.decode();
  }
}

export default function ProjectDetailExperience({
  initialProject,
  initialProjectIndex,
  initialRelatedProjects,
  projects,
}: ProjectDetailExperienceProps) {
  const [selection, setSelection] = useState<ProjectSelection>({
    project: initialProject,
    projectIndex: initialProjectIndex,
    relatedProjects: initialRelatedProjects,
  });
  const [pendingProjectSlug, setPendingProjectSlug] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const rootRef = useRef<HTMLElement>(null);
  const selectionRef = useRef(selection);
  const pendingAnchorRef = useRef<ProjectSwitchAnchor | null>(null);
  const settleHistoryAnchorRef = useRef(false);
  const switchSequenceRef = useRef(0);
  const selectionPromisesRef = useRef(new Map<string, Promise<ProjectSelection | null>>());
  const heroPromisesRef = useRef(new Map<string, Promise<void>>());
  selectionRef.current = selection;

  const loadSelection = useCallback((slug: string) => {
    const cached = selectionPromisesRef.current.get(slug);
    if (cached) return cached;

    const promise = loadProjectRecords()
      .then((projectRecords) => resolveSelection(projectRecords, slug));
    selectionPromisesRef.current.set(slug, promise);
    return promise;
  }, []);

  const prepareProject = useCallback(async (slug: string) => {
    const nextSelection = await loadSelection(slug);
    if (!nextSelection) return null;

    const targetHero = getProjectCaseStudyHero(nextSelection.project);
    const currentHero = rootRef.current
      ?.querySelector<HTMLImageElement>('.project-case-study__hero img');
    const preloadSource = getProjectHeroPreloadUrl(
      targetHero.src,
      currentHero?.currentSrc ?? '',
      window.location.origin,
    );
    let heroPromise = heroPromisesRef.current.get(preloadSource);
    if (!heroPromise) {
      heroPromise = decodeImage(preloadSource);
      heroPromisesRef.current.set(preloadSource, heroPromise);
    }

    try {
      await heroPromise;
    } catch {
      heroPromisesRef.current.delete(preloadSource);
      return null;
    }
    return nextSelection;
  }, [loadSelection]);

  const switchProject = useCallback(async (
    slug: string,
    historyMode: 'none' | 'push',
  ) => {
    if (slug === selectionRef.current.project.slug) return;

    const switchSequence = switchSequenceRef.current + 1;
    switchSequenceRef.current = switchSequence;
    setPendingProjectSlug(slug);

    let nextSelection: ProjectSelection | null = null;
    try {
      nextSelection = await prepareProject(slug);
    } catch {
      // Preserve the current, fully rendered project if its replacement cannot
      // be prepared. The canonical link remains available for a later retry.
    }
    if (!nextSelection || switchSequenceRef.current !== switchSequence) {
      if (switchSequenceRef.current === switchSequence) {
        setPendingProjectSlug(null);
        if (!nextSelection) {
          setAnnouncement('The next project could not be prepared. Please try again.');
        }
      }
      return;
    }

    const root = rootRef.current;
    pendingAnchorRef.current = root ? captureProjectSwitchAnchor(root) : null;
    settleHistoryAnchorRef.current = historyMode === 'none';

    if (historyMode === 'push') {
      window.history.pushState(
        buildProjectDetailHistoryState(window.history.state, slug),
        '',
        `/projects/${slug}`,
      );
    }

    selectionRef.current = nextSelection;
    setSelection(nextSelection);
    setPendingProjectSlug(null);
    setAnnouncement(`${nextSelection.project.title} project loaded.`);
  }, [prepareProject]);

  const handleProjectIntent = useCallback((slug: string) => {
    if (!window.matchMedia('(min-width: 900px)').matches) return;
    void prepareProject(slug).catch(() => undefined);
  }, [prepareProject]);

  const handleProjectSelect = useCallback((
    slug: string,
    event: ReactMouseEvent<HTMLAnchorElement>,
  ) => {
    if (!shouldUseInPlaceProjectNavigation(
      event,
      window.matchMedia('(min-width: 900px)').matches,
    )) return;

    event.preventDefault();
    void switchProject(slug, 'push');
  }, [switchProject]);

  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    const root = rootRef.current;
    if (!anchor || !root) return;

    restoreProjectSwitchAnchor(root, anchor);
    pendingAnchorRef.current = null;
    if (!settleHistoryAnchorRef.current) return;

    settleHistoryAnchorRef.current = false;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      restoreProjectSwitchAnchor(root, anchor);
      secondFrame = window.requestAnimationFrame(() => {
        restoreProjectSwitchAnchor(root, anchor);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [selection.project.slug]);

  useEffect(() => {
    if (initialProject.slug === selectionRef.current.project.slug) return;

    const serverSelection = {
      project: initialProject,
      projectIndex: initialProjectIndex,
      relatedProjects: initialRelatedProjects,
    };
    switchSequenceRef.current += 1;
    pendingAnchorRef.current = null;
    settleHistoryAnchorRef.current = false;
    selectionRef.current = serverSelection;
    setSelection(serverSelection);
    setPendingProjectSlug(null);
  }, [initialProject, initialProjectIndex, initialRelatedProjects]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 900px)');
    const previousScrollRestoration = window.history.scrollRestoration;
    const syncScrollRestoration = () => {
      window.history.scrollRestoration = desktopQuery.matches
        ? 'manual'
        : previousScrollRestoration;
    };
    const enableDesktopProjectSwitching = () => {
      syncScrollRestoration();
      if (!desktopQuery.matches) return;
      const currentSlug = getProjectDetailSlug(window.location.pathname);
      if (currentSlug) {
        window.history.replaceState(
          buildProjectDetailHistoryState(window.history.state, currentSlug),
          '',
          window.location.href,
        );
      }
      void loadProjectRecords();
    };
    const handlePopState = (event: PopStateEvent) => {
      if (!desktopQuery.matches) return;
      const slug = getProjectDetailSlug(window.location.pathname);
      if (!slug || slug === selectionRef.current.project.slug) return;

      const currentRoute = `/projects/${selectionRef.current.project.slug}`;
      if (!shouldPreserveProjectDetailScroll(
        currentRoute,
        window.location.pathname,
        event.state,
      )) return;

      // Next's normal popstate traversal replaces the dynamic page subtree.
      // Keep this explicitly marked desktop detail-to-detail transition in the
      // persistent owner, then use its patched replaceState to synchronize
      // usePathname consumers without fetching or remounting the route.
      event.stopImmediatePropagation();
      window.history.replaceState(
        buildProjectDetailHistoryState(event.state, slug),
        '',
        window.location.href,
      );
      void switchProject(slug, 'none');
    };

    enableDesktopProjectSwitching();
    desktopQuery.addEventListener('change', enableDesktopProjectSwitching);
    window.addEventListener('popstate', handlePopState, { capture: true });
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
      desktopQuery.removeEventListener('change', enableDesktopProjectSwitching);
      window.removeEventListener('popstate', handlePopState, { capture: true });
    };
  }, [switchProject]);

  const activeProject = projects.find(
    (project) => project.slug === selection.project.slug,
  ) ?? projects[0]!;

  return (
    <>
      <ProjectRuntimeMetadata project={selection.project} />
      <JsonLd data={buildProjectStructuredData(selection.project)} />
      <main
        ref={rootRef}
        className="projects-experience"
        aria-label={`${selection.project.title} project case study`}
        data-marketing-foundation-page
        data-projects-experience
        data-project-switch-state={pendingProjectSlug ? 'loading' : 'ready'}
      >
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        <div className="projects-experience__layout">
          <ProjectNavigator
            projects={projects}
            activeProject={activeProject}
            onProjectIntent={handleProjectIntent}
            onProjectSelect={handleProjectSelect}
            pendingProjectSlug={pendingProjectSlug}
          />
          <ProjectDetailContent
            project={selection.project}
            projectIndex={selection.projectIndex}
            projectCount={projects.length}
            relatedProjects={selection.relatedProjects}
            showBreadcrumb
            sourcePath={`/projects/${selection.project.slug}`}
            titleAs="h1"
          />
        </div>
      </main>
    </>
  );
}
