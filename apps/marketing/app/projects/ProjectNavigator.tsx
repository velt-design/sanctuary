'use client';

import Link from 'next/link';
import {
  usePathname,
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Disclosure,
  EditorialCard,
} from '@/components/marketing-foundation';
import {
  ALL_PROJECT_FILTERS,
  PROJECT_AUDIENCE_OPTIONS,
  buildProjectFilterHref,
  filterProjects,
  getProjectFormOptions,
  readProjectFilters,
  type ProjectAudienceFilter,
  type ProjectFilters,
} from './projectFilters';
import {
  DEFAULT_PROJECT_CARD_SIZE,
  PROJECT_CARD_SIZE_OPTIONS,
  PROJECT_CARD_SIZE_STORAGE_KEY,
  getProjectCardImageSizes,
  getProjectCardSizeIndex,
  getProjectCardSizeOption,
  parseProjectCardSize,
  type ProjectCardSize,
} from './projectCardSize';
import type { ProjectCollectionItem } from './projectCollection';
import { getProjectFormLabel } from './projectPresentation';

type ProjectNavigatorProps = {
  projects: ProjectCollectionItem[];
  activeProject: ProjectCollectionItem;
  collectionMode?: boolean;
  initialSearchParams?: string;
  onProjectIntent?: (slug: string) => void;
  onProjectSelect?: (
    slug: string,
    event: ReactMouseEvent<HTMLAnchorElement>,
  ) => void;
  pendingProjectSlug?: string | null;
  buildProjectHref?: (slug: string) => string;
};

export default function ProjectNavigator({
  projects,
  activeProject,
  collectionMode = false,
  initialSearchParams = '',
  onProjectIntent,
  onProjectSelect,
  pendingProjectSlug = null,
  buildProjectHref = (slug) => `/projects/${slug}`,
}: ProjectNavigatorProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [detailAudienceFilter, setDetailAudienceFilter] = useState<ProjectAudienceFilter>(
    ALL_PROJECT_FILTERS,
  );
  const [detailFormFilter, setDetailFormFilter] = useState(ALL_PROJECT_FILTERS);
  const [isOpen, setIsOpen] = useState(false);
  const [isCompact, setIsCompact] = useState<boolean | null>(null);
  const [cardSize, setCardSize] = useState<ProjectCardSize>(DEFAULT_PROJECT_CARD_SIZE);
  const [isCardSizeReady, setIsCardSizeReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeIndex = projects.findIndex((project) => project.slug === activeProject.slug);
  const formOptions = useMemo(() => getProjectFormOptions(projects), [projects]);
  const searchParams = useMemo(
    () => new URLSearchParams(initialSearchParams),
    [initialSearchParams],
  );
  const urlFilters = useMemo(
    () => readProjectFilters(searchParams, projects),
    [projects, searchParams],
  );
  const filters = collectionMode
    ? urlFilters
    : {
      audience: detailAudienceFilter,
      form: detailFormFilter,
    };
  const filteredProjects = useMemo(
    () => filterProjects(projects, filters),
    [filters, projects],
  );
  const activeFilterCount = Number(filters.audience !== ALL_PROJECT_FILTERS)
    + Number(filters.form !== ALL_PROJECT_FILTERS);
  const cardSizeOption = getProjectCardSizeOption(getProjectCardSizeIndex(cardSize));

  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)');
    const update = () => {
      setIsCompact(media.matches);
      if (!media.matches) setIsOpen(false);
    };

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!collectionMode) return;

    try {
      const storedCardSize = parseProjectCardSize(
        window.localStorage.getItem(PROJECT_CARD_SIZE_STORAGE_KEY),
      );
      if (storedCardSize) setCardSize(storedCardSize);
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }

    setIsCardSizeReady(true);
  }, [collectionMode]);

  useEffect(() => {
    if (collectionMode || !isCompact || !isOpen) return;

    const root = document.documentElement;
    const body = document.body;
    root.classList.add('projects-navigator-open');
    body.classList.add('projects-navigator-open');

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), summary, a[href]',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      root.classList.remove('projects-navigator-open');
      body.classList.remove('projects-navigator-open');
      triggerRef.current?.focus();
    };
  }, [collectionMode, isCompact, isOpen]);

  const updateFilters = (nextFilters: ProjectFilters) => {
    if (collectionMode) {
      router.push(
        buildProjectFilterHref(pathname || '/projects', searchParams, nextFilters),
        { scroll: false },
      );
      return;
    }

    setDetailAudienceFilter(nextFilters.audience);
    setDetailFormFilter(nextFilters.form);
  };
  const resetFilters = () => updateFilters({
    audience: ALL_PROJECT_FILTERS,
    form: ALL_PROJECT_FILTERS,
  });
  const closeNavigator = () => setIsOpen(false);
  const openNavigator = () => {
    setIsOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        closeRef.current?.focus();
      });
    });
  };
  const updateCardSize = (nextCardSize: ProjectCardSize) => {
    setCardSize(nextCardSize);
    try {
      window.localStorage.setItem(PROJECT_CARD_SIZE_STORAGE_KEY, nextCardSize);
    } catch {
      // The selected size still applies for this visit when storage is unavailable.
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const links = Array.from(
      event.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]'),
    );
    if (!links.length) return;

    event.preventDefault();
    const currentIndex = links.findIndex((link) => link === document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = links.length - 1;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % links.length;
    }
    if (event.key === 'ArrowUp') {
      nextIndex = currentIndex < 0
        ? links.length - 1
        : (currentIndex - 1 + links.length) % links.length;
    }

    links[nextIndex]?.focus();
  };

  const isModal = isCompact === true && !collectionMode;
  const filterControls = (
    <div className="project-navigator__filters" role="group" aria-label="Filter projects">
      <label>
        <span>Audience</span>
        <select
          aria-label="Filter by audience"
          value={filters.audience}
          onChange={(event) => updateFilters({
            ...filters,
            audience: event.target.value as ProjectAudienceFilter,
          })}
        >
          <option value={ALL_PROJECT_FILTERS}>All audiences</option>
          {PROJECT_AUDIENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Roof form</span>
        <select
          aria-label="Filter by roof form"
          value={filters.form}
          onChange={(event) => updateFilters({
            ...filters,
            form: event.target.value,
          })}
        >
          <option value={ALL_PROJECT_FILTERS}>All roof forms</option>
          {formOptions.map((form) => (
            <option key={form.value} value={form.value}>{form.label}</option>
          ))}
        </select>
      </label>
      {activeFilterCount ? (
        <button
          type="button"
          className="project-navigator__filter-reset"
          onClick={resetFilters}
        >
          Reset filters
        </button>
      ) : null}
    </div>
  );
  const navigatorPanel = (
    <div
      ref={panelRef}
      id="project-navigator-panel"
      className="project-navigator__panel"
      data-open={collectionMode || isOpen ? 'true' : 'false'}
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal ? true : undefined}
      aria-labelledby="project-navigator-title"
      aria-hidden={isModal ? !isOpen : undefined}
      inert={isModal && !isOpen}
    >
      <div className="project-navigator__header">
        <div>
          <p className="project-navigator__eyebrow">
            Project {String(activeIndex + 1).padStart(2, '0')} of {String(projects.length).padStart(2, '0')}
          </p>
          <h2 id="project-navigator-title">{activeProject.title}</h2>
          <p>{activeProject.location}</p>
          <span>{activeProject.type} / {getProjectFormLabel(activeProject)}</span>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="project-navigator__close"
          aria-label="Close project navigator"
          onClick={closeNavigator}
        >
          Close
        </button>
      </div>

      {collectionMode ? (
        <div className="project-navigator__index-bar" data-project-index-bar>
          <Disclosure
            className="project-navigator__filter-disclosure"
            bodyClassName="project-navigator__filter-body"
            data-project-filter-disclosure
            desktopMinWidth={900}
            icon={(
              <span className="project-navigator__filter-icon" aria-hidden="true">
                +
              </span>
            )}
            mode="desktop-expanded"
            summary={(
              <span className="project-navigator__filter-summary-copy">
                <strong>Filter projects</strong>
                <span>
                  {activeFilterCount
                    ? `${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'} active`
                    : 'Optional'}
                </span>
              </span>
            )}
            summaryClassName="project-navigator__filter-summary"
            unstyled
          >
            {filterControls}
          </Disclosure>
          <div className="project-navigator__collection-tools">
            <p className="project-navigator__result-count" aria-live="polite" aria-atomic="true">
              {filteredProjects.length === projects.length
                ? `${projects.length} projects`
                : `${filteredProjects.length} of ${projects.length} projects`}
            </p>
            {isCardSizeReady ? (
              <div
                className="project-card-size"
                data-project-card-size-control
                data-project-card-size-index={getProjectCardSizeIndex(cardSize)}
              >
                <div className="project-card-size__heading">
                  <label htmlFor="project-card-size">View scale</label>
                  <output htmlFor="project-card-size" aria-live="polite">
                    {cardSizeOption.label} / {cardSizeOption.scale}
                  </output>
                </div>
                <div className="project-card-size__control">
                  <input
                    id="project-card-size"
                    type="range"
                    min="0"
                    max={PROJECT_CARD_SIZE_OPTIONS.length - 1}
                    step="1"
                    value={getProjectCardSizeIndex(cardSize)}
                    aria-valuetext={`${cardSizeOption.label}, ${cardSizeOption.description}`}
                    onChange={(event) => updateCardSize(
                      getProjectCardSizeOption(Number(event.currentTarget.value)).value,
                    )}
                  />
                  <div className="project-card-size__rail" aria-hidden="true">
                    {PROJECT_CARD_SIZE_OPTIONS.map((option, index) => (
                      <span
                        key={option.value}
                        className="project-card-size__stop"
                        data-project-card-size-stop={index}
                      >
                        {option.scale}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {filterControls}
          <p className="project-navigator__result-count" aria-live="polite" aria-atomic="true">
            Showing {filteredProjects.length} of {projects.length} projects
          </p>
        </>
      )}

      <nav className="project-navigator__list-wrap" aria-label="Project case studies">
        {filteredProjects.length ? (
          <ol className="project-navigator__list" onKeyDown={handleListKeyDown}>
            {filteredProjects.map((project, filteredIndex) => {
              const isActive = project.slug === activeProject.slug;

              return (
                <li key={project.slug}>
                  {collectionMode ? (
                    <EditorialCard
                      actionLabel="View project"
                      aria-label={`${project.title}. ${project.location}. ${project.type}. ${getProjectFormLabel(project)}. View project`}
                      className={`project-navigator__card${isActive ? ' is-active' : ''}`}
                      condensedMeta={`${project.region} · ${project.type} · ${getProjectFormLabel(project)}`}
                      copy={`${project.type} / ${getProjectFormLabel(project)}`}
                      data-project-card={project.slug}
                      eyebrow={project.location}
                      headingLevel="h2"
                      href={buildProjectHref(project.slug)}
                      media={{
                        image: project.heroImage.src,
                        alt: project.heroImage.alt,
                        ratio: 'landscape',
                        mobileRatio: 'portrait',
                        priority: filteredIndex === 0
                          || (isCompact === false && filteredIndex === 1),
                        sizes: getProjectCardImageSizes(cardSize),
                        objectPosition: project.heroImage.objectPosition ?? 'center',
                        mobileObjectPosition: project.heroImage.objectPosition ?? 'center',
                      }}
                      title={project.title}
                      variant="image-led"
                    />
                  ) : (
                    <Link
                      href={`/projects/${project.slug}`}
                      className={isActive ? 'is-active' : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      aria-busy={pendingProjectSlug === project.slug || undefined}
                      data-project-switch-pending={
                        pendingProjectSlug === project.slug ? 'true' : undefined
                      }
                      data-project-detail-switch={
                        onProjectSelect ? 'true' : undefined
                      }
                      onFocus={() => onProjectIntent?.(project.slug)}
                      onPointerEnter={() => onProjectIntent?.(project.slug)}
                      onClick={(event) => {
                        onProjectSelect?.(project.slug, event);
                        if (!event.defaultPrevented) closeNavigator();
                      }}
                    >
                      <span className="project-navigator__item-number">
                        {String(projects.findIndex(
                          (candidate) => candidate.slug === project.slug,
                        ) + 1).padStart(2, '0')}
                      </span>
                      <span className="project-navigator__item-copy">
                        <strong>{project.title}</strong>
                        <span>{project.region}</span>
                        <small>{project.type} / {getProjectFormLabel(project)}</small>
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="project-navigator__empty">
            <p>No projects match both filters.</p>
            <button type="button" onClick={resetFilters}>
              View all projects
            </button>
          </div>
        )}
      </nav>
    </div>
  );

  const mobileLayer = isModal && typeof document !== 'undefined'
    ? createPortal(
      <div className="project-navigator-layer">
        {isOpen ? (
          <button
            type="button"
            className="project-navigator__backdrop"
            aria-label="Close project navigator"
            tabIndex={-1}
            onClick={closeNavigator}
          />
        ) : null}
        {navigatorPanel}
      </div>,
      document.body,
    )
    : null;

  return (
    <aside
      className={`project-navigator${collectionMode ? ' project-navigator--collection' : ''}`}
      aria-label={collectionMode ? 'Browse and filter projects' : 'Project navigator'}
      data-project-navigator
      data-project-collection={collectionMode ? 'true' : undefined}
      data-project-card-size={collectionMode ? cardSize : undefined}
    >
      {!collectionMode ? (
        <button
          ref={triggerRef}
          type="button"
          className="project-navigator__trigger"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls="project-navigator-panel"
          onClick={openNavigator}
        >
          <span className="project-navigator__trigger-count">
            {String(activeIndex + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
          </span>
          <span className="project-navigator__trigger-title">{activeProject.title}</span>
          <span className="project-navigator__trigger-action">Browse</span>
        </button>
      ) : null}
      {isModal ? mobileLayer : navigatorPanel}
    </aside>
  );
}
