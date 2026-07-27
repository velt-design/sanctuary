const STICKY_CHROME_SELECTOR = [
  '[data-portal-mobile-top-bar]',
  '[data-project-masthead-slot-sticky="true"]',
  '[data-calculator-command-bar]',
].join(',');

const VIEWPORT_MARGIN_PX = 16;

function isDocumentScrollOwner(element: HTMLElement): boolean {
  return element === document.documentElement
    || element === document.body
    || element === document.scrollingElement;
}

function canScrollVertically(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY || style.overflow;
  return /^(auto|scroll|overlay)$/.test(overflowY)
    && element.scrollHeight > element.clientHeight + 1;
}

export function findCalculatorVerticalScrollOwner(target: HTMLElement): HTMLElement {
  let ancestor = target.parentElement;
  while (ancestor) {
    if (canScrollVertically(ancestor)) return ancestor;
    ancestor = ancestor.parentElement;
  }

  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function visibleStickyTop(scrollOwner: HTMLElement): number {
  let top = isDocumentScrollOwner(scrollOwner)
    ? 0
    : scrollOwner.getBoundingClientRect().top;

  const chrome = Array.from(document.querySelectorAll<HTMLElement>(STICKY_CHROME_SELECTOR))
    .map((element) => ({
      element,
      rect: element.getBoundingClientRect(),
      style: window.getComputedStyle(element),
    }))
    .filter(({ rect, style }) =>
      (style.position === 'fixed' || style.position === 'sticky')
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && rect.width > 0
      && rect.height > 0,
    )
    .sort((left, right) => left.rect.top - right.rect.top);

  for (const { rect } of chrome) {
    if (rect.bottom <= top || rect.top > top + 1) continue;
    top = Math.max(top, rect.bottom);
  }

  return top;
}

function visibleBottom(scrollOwner: HTMLElement): number {
  if (isDocumentScrollOwner(scrollOwner)) return window.innerHeight;
  return Math.min(window.innerHeight, scrollOwner.getBoundingClientRect().bottom);
}

function revealNodeFor(target: HTMLElement): HTMLElement {
  return target.closest<HTMLElement>('[data-calculator-field]') ?? target;
}

function visibleHeight(scrollOwner: HTMLElement): number {
  return Math.max(
    0,
    visibleBottom(scrollOwner) - visibleStickyTop(scrollOwner) - VIEWPORT_MARGIN_PX * 2,
  );
}

function focusTargetFor(target: HTMLElement): HTMLElement {
  const focusableSelector =
    'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
  if (target.matches(focusableSelector)) {
    return target;
  }

  const invalidTarget = Array.from(
    target.querySelectorAll<HTMLElement>('[aria-invalid="true"]'),
  ).find((element) => element.matches(focusableSelector));

  return invalidTarget ?? target.querySelector<HTMLElement>(focusableSelector) ?? target;
}

function correctionTargetFor(
  revealNode: HTMLElement,
  focusTarget: HTMLElement,
  scrollOwner: HTMLElement,
): HTMLElement {
  if (revealNode.getBoundingClientRect().height <= visibleHeight(scrollOwner)) {
    return revealNode;
  }

  return focusTarget.closest<HTMLElement>('[data-calculator-focus-region]') ?? focusTarget;
}

function correctionFor(
  target: HTMLElement,
  scrollOwner: HTMLElement,
): number {
  const top = visibleStickyTop(scrollOwner) + VIEWPORT_MARGIN_PX;
  const bottom = visibleBottom(scrollOwner) - VIEWPORT_MARGIN_PX;
  const rect = target.getBoundingClientRect();
  const availableHeight = Math.max(0, bottom - top);

  if (rect.top >= top && rect.bottom <= bottom) return 0;
  if (rect.height >= availableHeight) return rect.top - top;
  return (rect.top + rect.bottom) / 2 - (top + bottom) / 2;
}

function applyCorrection(target: HTMLElement, scrollOwner: HTMLElement): void {
  const correction = correctionFor(target, scrollOwner);
  if (Math.abs(correction) < 1) return;
  scrollOwner.scrollTop += correction;
}

export function revealAndFocusCalculatorTarget(target: HTMLElement): HTMLElement {
  const revealNode = revealNodeFor(target);
  const scrollOwner = findCalculatorVerticalScrollOwner(revealNode);
  const focusTarget = focusTargetFor(target);
  const correctionTarget = correctionTargetFor(revealNode, focusTarget, scrollOwner);

  applyCorrection(correctionTarget, scrollOwner);

  try {
    focusTarget.focus({ preventScroll: true });
  } catch {
    focusTarget.focus();
  }

  applyCorrection(correctionTarget, scrollOwner);
  return scrollOwner;
}

export function scheduleCalculatorLayoutTask(task: () => void): () => void {
  let firstFrame = 0;
  let secondFrame = 0;
  let cancelled = false;

  firstFrame = window.requestAnimationFrame(() => {
    if (cancelled) return;
    secondFrame = window.requestAnimationFrame(() => {
      if (!cancelled) task();
    });
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(firstFrame);
    window.cancelAnimationFrame(secondFrame);
  };
}
