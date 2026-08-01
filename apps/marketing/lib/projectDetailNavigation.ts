const PROJECT_DETAIL_HISTORY_KEY = '__sanctuaryProjectDetailSlug';

export type ProjectSwitchAnchor = {
  mode: 'align' | 'preserve';
  viewportTop: number;
};

type ProjectDetailClickLike = {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  currentTarget: { target: string };
  metaKey: boolean;
  shiftKey: boolean;
};

export function shouldUseInPlaceProjectNavigation(
  event: ProjectDetailClickLike,
  desktop: boolean,
): boolean {
  return desktop
    && event.button === 0
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey
    && event.currentTarget.target !== '_blank';
}

function asHistoryRecord(state: unknown): Record<string, unknown> {
  return state && typeof state === 'object'
    ? state as Record<string, unknown>
    : {};
}

export function getProjectDetailSlug(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/projects\/([^/?#]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function buildProjectDetailHistoryState(
  state: unknown,
  slug: string,
): Record<string, unknown> {
  const publicState = { ...asHistoryRecord(state) };
  delete publicState.__NA;
  delete publicState._N;
  delete publicState.__PRIVATE_NEXTJS_INTERNALS_TREE;

  return {
    ...publicState,
    [PROJECT_DETAIL_HISTORY_KEY]: slug,
  };
}

export function shouldPreserveProjectDetailScroll(
  previousPathname: string | null,
  nextPathname: string | null,
  state: unknown,
): boolean {
  const previousSlug = getProjectDetailSlug(previousPathname);
  const nextSlug = getProjectDetailSlug(nextPathname);
  if (!previousSlug || !nextSlug || previousSlug === nextSlug) return false;

  return asHistoryRecord(state)[PROJECT_DETAIL_HISTORY_KEY] === nextSlug;
}

export function captureProjectSwitchAnchor(
  root: HTMLElement,
): ProjectSwitchAnchor | null {
  const hero = root.querySelector<HTMLElement>('.project-case-study__hero');
  if (!hero) return null;

  const heroBounds = hero.getBoundingClientRect();
  const headerBottom = Math.max(
    0,
    document.querySelector<HTMLElement>('header.site')
      ?.getBoundingClientRect().bottom ?? 0,
  );
  const heroIntersectsViewport = heroBounds.bottom > headerBottom
    && heroBounds.top < window.innerHeight;

  return {
    mode: heroIntersectsViewport ? 'preserve' : 'align',
    viewportTop: heroIntersectsViewport ? heroBounds.top : headerBottom,
  };
}

export function restoreProjectSwitchAnchor(
  root: HTMLElement,
  anchor: ProjectSwitchAnchor,
): number {
  const hero = root.querySelector<HTMLElement>('.project-case-study__hero');
  if (!hero) return 0;

  const delta = hero.getBoundingClientRect().top - anchor.viewportTop;
  if (Math.abs(delta) < 0.5) return 0;

  const nextTop = Math.max(0, window.scrollY + delta);
  try {
    window.scrollTo({
      top: nextTop,
      left: window.scrollX,
      behavior: 'auto',
    });
  } catch {
    window.scrollTo(window.scrollX, nextTop);
  }
  return delta;
}

export function getProjectHeroPreloadUrl(
  targetSource: string,
  currentSource: string,
  origin: string,
): string {
  try {
    const currentUrl = new URL(currentSource, origin);
    if (currentUrl.pathname === '/_next/image' && currentUrl.searchParams.has('url')) {
      currentUrl.searchParams.set('url', targetSource);
      return currentUrl.toString();
    }
    return new URL(targetSource, origin).toString();
  } catch {
    return targetSource;
  }
}
