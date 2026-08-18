import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Disclosure } from './Disclosure';
import { ResponsiveGallery, type ResponsiveGalleryItem } from './ResponsiveGallery';

const galleryItems: ResponsiveGalleryItem[] = [
  {
    id: 'first',
    image: '/images/project-riverhead-gable-01.jpg',
    alt: 'First completed pergola',
    caption: 'First project',
  },
  {
    id: 'second',
    image: '/images/project-dairy-flat-01.jpg',
    alt: 'Second completed pergola',
    caption: 'Second project',
  },
  {
    id: 'third',
    image: '/images/project-velskov-01.jpg',
    alt: 'Third completed pergola',
    caption: 'Third project',
  },
];

let root: Root | null = null;

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'IntersectionObserver');
});

async function render(markup: ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(markup));
  return container;
}

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((media: string) => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media,
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  });
}

describe('marketing foundation disclosure', () => {
  it('renders one native semantic content tree without manual ARIA state', () => {
    document.body.innerHTML = renderToStaticMarkup(
      <Disclosure summary="Project detail">
        <p>One complete project description.</p>
      </Disclosure>,
    );

    const details = document.querySelector('details[data-disclosure="manual"]');
    const summary = details?.querySelector(':scope > summary');

    expect(details).not.toBeNull();
    expect(summary?.textContent).toContain('Project detail');
    expect(summary?.hasAttribute('aria-expanded')).toBe(false);
    expect(document.querySelectorAll('p')).toHaveLength(1);
    expect(document.body.textContent?.match(/One complete project description/g)).toHaveLength(1);
  });

  it('uses native toggle state and keeps focus on the summary control', async () => {
    const onOpenChange = vi.fn();
    const container = await render(
      <Disclosure summary="Project detail" onOpenChange={onOpenChange}>
        <p>Disclosure content.</p>
      </Disclosure>,
    );
    const details = container.querySelector('details') as HTMLDetailsElement;
    const summary = container.querySelector('summary') as HTMLElement;

    summary.focus();
    await act(async () => {
      summary.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(details.open).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(document.activeElement).toBe(summary);

    await act(async () => {
      summary.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(details.open).toBe(false);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).toBe(summary);
  });

  it('server-renders responsive content open for no-JavaScript access', () => {
    document.body.innerHTML = renderToStaticMarkup(
      <Disclosure mode="desktop-expanded" desktopMinWidth={721} summary="More detail">
        <a href="/contact">Contact Sanctuary</a>
      </Disclosure>,
    );

    const details = document.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(details.dataset.disclosureState).toBe('pending');
    expect(details.dataset.disclosureDesktopMin).toBe('721');
    expect(details.querySelectorAll('a')).toHaveLength(1);
  });

  it('resolves the pending state to native closed mobile or open desktop state', async () => {
    installMatchMedia(false);
    const mobile = await render(
      <Disclosure mode="desktop-expanded" summary="More detail">
        <p>Responsive content.</p>
      </Disclosure>,
    );
    const mobileDetails = mobile.querySelector('details') as HTMLDetailsElement;
    expect(mobileDetails.dataset.disclosureState).toBe('mobile');
    expect(mobileDetails.open).toBe(false);

    await act(async () => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    installMatchMedia(true);

    const desktop = await render(
      <Disclosure mode="desktop-expanded" summary="More detail">
        <p>Responsive content.</p>
      </Disclosure>,
    );
    const desktopDetails = desktop.querySelector('details') as HTMLDetailsElement;
    expect(desktopDetails.dataset.disclosureState).toBe('desktop');
    expect(desktopDetails.open).toBe(true);
  });
});

describe('marketing foundation responsive gallery', () => {
  it('renders only the active item with labelled controls and live position status', async () => {
    const container = await render(
      <ResponsiveGallery label="Completed projects" items={galleryItems} />,
    );
    const gallery = container.querySelector('[data-responsive-gallery]');

    expect(gallery?.getAttribute('role')).toBe('region');
    expect(gallery?.getAttribute('aria-roledescription')).toBe('carousel');
    expect(gallery?.getAttribute('aria-label')).toBe('Completed projects');
    expect(gallery?.querySelectorAll('img')).toHaveLength(1);
    expect(gallery?.querySelector('img')?.getAttribute('alt')).toBe('First completed pergola');
    expect(gallery?.querySelector('[role="status"]')?.textContent).toBe('Image 1 of 3');
    expect(gallery?.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
    expect(gallery?.querySelectorAll('button')).toHaveLength(2);
    expect(gallery?.querySelector('button')?.getAttribute('aria-label')).toContain('Previous image');
  });

  it('keeps single-item gallery controls disabled without changing status semantics', async () => {
    const container = await render(
      <ResponsiveGallery label="Completed projects" items={[galleryItems[0]]} />,
    );
    const gallery = container.querySelector('[data-responsive-gallery]');
    const buttons = [...(gallery?.querySelectorAll('button') ?? [])];

    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(gallery?.querySelectorAll('img')).toHaveLength(1);
    expect(gallery?.querySelector('[role="status"]')?.textContent).toBe('Image 1 of 1');
  });

  it('supports buttons and Arrow, Home and End keys without moving focus', async () => {
    const container = await render(
      <ResponsiveGallery label="Completed projects" items={galleryItems} />,
    );
    const gallery = container.querySelector('[data-responsive-gallery]') as HTMLElement;
    const next = container.querySelector('button[aria-label^="Next"]') as HTMLButtonElement;

    next.focus();
    await act(async () => next.click());
    expect(gallery.dataset.galleryPosition).toBe('2/3');
    expect(gallery.querySelector('img')?.getAttribute('alt')).toBe('Second completed pergola');
    expect(gallery.querySelectorAll('img')).toHaveLength(1);
    expect(document.activeElement).toBe(next);

    await act(async () => {
      gallery.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End' }));
    });
    expect(gallery.dataset.galleryPosition).toBe('3/3');

    await act(async () => {
      gallery.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Home' }));
    });
    expect(gallery.dataset.galleryPosition).toBe('1/3');

    await act(async () => {
      gallery.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' }));
    });
    expect(gallery.dataset.galleryPosition).toBe('3/3');
    expect(gallery.querySelector('img')?.getAttribute('alt')).toBe('Third completed pergola');
    expect(gallery.querySelectorAll('img')).toHaveLength(1);
    expect(document.activeElement).toBe(next);
  });

  it('follows horizontal touch intent, defers capture and commits one adjacent item', async () => {
    vi.useFakeTimers();
    installMatchMedia(false);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => (
      window.setTimeout(() => callback(0), 1)
    ));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      window.clearTimeout(frameId);
    });
    const container = await render(
      <ResponsiveGallery label="Completed projects" items={galleryItems} swipe />,
    );
    const gallery = container.querySelector('[data-responsive-gallery]') as HTMLElement;
    const viewport = gallery.firstElementChild as HTMLElement;
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 320 },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
      setPointerCapture: { configurable: true, value: setPointerCapture },
    });
    const dispatchPointer = (
      type: 'pointerdown' | 'pointermove' | 'pointerup',
      clientX: number,
      clientY: number,
    ) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientX: { value: clientX },
        clientY: { value: clientY },
        isPrimary: { value: true },
        pointerId: { value: 1 },
        pointerType: { value: 'touch' },
      });
      viewport.dispatchEvent(event);
      return event;
    };

    expect(gallery.dataset.gallerySwipe).toBe('true');
    await act(async () => {
      dispatchPointer('pointerdown', 300, 200);
      expect(setPointerCapture).not.toHaveBeenCalled();
      dispatchPointer('pointermove', 296, 202);
      expect(setPointerCapture).not.toHaveBeenCalled();
      const move = dispatchPointer('pointermove', 276, 203);
      expect(move.defaultPrevented).toBe(true);
      vi.advanceTimersByTime(1);
    });
    expect(setPointerCapture).toHaveBeenCalledOnce();
    expect(viewport.dataset.galleryGesture).toBe('dragging-horizontal');
    expect(viewport.style.getPropertyValue('--gallery-drag-x')).toBe('-24px');
    expect(gallery.dataset.galleryPosition).toBe('1/3');
    expect(gallery.querySelector('[role="status"]')?.textContent).toBe('Image 1 of 3');
    expect(gallery.querySelectorAll('img')).toHaveLength(3);

    await act(async () => {
      dispatchPointer('pointerup', 180, 205);
      expect(gallery.dataset.galleryPosition).toBe('1/3');
      vi.advanceTimersByTime(160);
    });
    expect(gallery.dataset.galleryPosition).toBe('2/3');
    expect(gallery.querySelector('[role="status"]')?.textContent).toBe('Image 2 of 3');
    expect(releasePointerCapture).toHaveBeenCalled();

    await act(async () => {
      dispatchPointer('pointerdown', 200, 100);
      dispatchPointer('pointermove', 196, 122);
      dispatchPointer('pointerup', 190, 220);
    });
    expect(gallery.dataset.galleryPosition).toBe('2/3');
    expect(viewport.dataset.galleryGesture).toBe('idle');

    await act(async () => {
      dispatchPointer('pointerdown', 180, 200);
      dispatchPointer('pointermove', 202, 203);
      vi.advanceTimersByTime(1);
      dispatchPointer('pointerup', 300, 205);
      vi.advanceTimersByTime(160);
    });
    expect(gallery.dataset.galleryPosition).toBe('1/3');
  });

  it('cancels short, interrupted and resized drags without stale movement', async () => {
    vi.useFakeTimers();
    installMatchMedia(false);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => (
      window.setTimeout(() => callback(0), 1)
    ));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      window.clearTimeout(frameId);
    });
    const container = await render(
      <ResponsiveGallery label="Completed projects" items={galleryItems} swipe />,
    );
    const gallery = container.querySelector('[data-responsive-gallery]') as HTMLElement;
    const viewport = gallery.firstElementChild as HTMLElement;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 320 },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      setPointerCapture: { configurable: true, value: vi.fn() },
    });
    const dispatchPointer = (
      type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
      clientX: number,
      clientY: number,
      pointerId = 1,
    ) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientX: { value: clientX },
        clientY: { value: clientY },
        isPrimary: { value: true },
        pointerId: { value: pointerId },
        pointerType: { value: 'touch' },
      });
      viewport.dispatchEvent(event);
    };

    await act(async () => {
      dispatchPointer('pointerdown', 200, 100);
      dispatchPointer('pointermove', 180, 102);
      vi.advanceTimersByTime(1);
      dispatchPointer('pointerup', 180, 102);
      vi.advanceTimersByTime(160);
    });
    expect(gallery.dataset.galleryPosition).toBe('1/3');
    expect(viewport.style.getPropertyValue('--gallery-drag-x')).toBe('0px');

    await act(async () => {
      dispatchPointer('pointerdown', 200, 100);
      dispatchPointer('pointermove', 150, 102);
      vi.advanceTimersByTime(1);
      dispatchPointer('pointercancel', 150, 102);
      vi.advanceTimersByTime(160);
    });
    expect(gallery.dataset.galleryPosition).toBe('1/3');
    expect(viewport.dataset.galleryGesture).toBe('idle');

    await act(async () => {
      dispatchPointer('pointerdown', 200, 100);
      dispatchPointer('pointermove', 150, 102);
      vi.advanceTimersByTime(1);
      window.dispatchEvent(new Event('resize'));
    });
    expect(viewport.dataset.galleryGesture).toBe('idle');
    expect(viewport.style.getPropertyValue('--gallery-drag-x')).toBe('0px');

    await act(async () => {
      dispatchPointer('pointerdown', 200, 100);
      dispatchPointer('pointerdown', 190, 100, 2);
    });
    expect(viewport.dataset.galleryGesture).toBe('idle');
  });

  it('mounts at most adjacent visual frames while exposing only the active item', async () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    class IntersectionObserverStub {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
      root = null;
      rootMargin = '160px 0px';
      thresholds = [0];

      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      takeRecords() {
        return [];
      }
    }
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: IntersectionObserverStub,
    });

    const container = await render(
      <ResponsiveGallery label="Completed projects" items={galleryItems} swipe />,
    );
    const gallery = container.querySelector('[data-responsive-gallery]') as HTMLElement;
    expect(gallery.querySelectorAll('img')).toHaveLength(1);

    await act(async () => {
      observerCallback?.([
        { isIntersecting: true } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    expect(gallery.querySelectorAll('[data-gallery-frame]')).toHaveLength(3);
    expect(gallery.querySelectorAll('[data-gallery-frame-active]')).toHaveLength(1);
    expect(gallery.querySelectorAll('[data-gallery-frame][aria-hidden="true"]')).toHaveLength(2);
    expect([...gallery.querySelectorAll('[data-gallery-frame][aria-hidden="true"] img')]
      .every((image) => image.getAttribute('alt') === '')).toBe(true);
    expect(gallery.querySelectorAll('figcaption')).toHaveLength(1);
    expect(gallery.querySelectorAll('[data-gallery-frame][aria-hidden="true"] a, [data-gallery-frame][aria-hidden="true"] button'))
      .toHaveLength(0);
  });

  it('commits immediately after release when reduced motion is requested', async () => {
    vi.useFakeTimers();
    installMatchMedia(true);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => (
      window.setTimeout(() => callback(0), 1)
    ));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      window.clearTimeout(frameId);
    });
    const container = await render(
      <ResponsiveGallery label="Completed projects" items={galleryItems} swipe />,
    );
    const gallery = container.querySelector('[data-responsive-gallery]') as HTMLElement;
    const viewport = gallery.firstElementChild as HTMLElement;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 320 },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      setPointerCapture: { configurable: true, value: vi.fn() },
    });
    const dispatchPointer = (type: string, clientX: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientX: { value: clientX },
        clientY: { value: 100 },
        isPrimary: { value: true },
        pointerId: { value: 1 },
        pointerType: { value: 'touch' },
      });
      viewport.dispatchEvent(event);
    };

    await act(async () => {
      dispatchPointer('pointerdown', 200);
      dispatchPointer('pointermove', 130);
      vi.advanceTimersByTime(1);
      dispatchPointer('pointerup', 120);
      vi.advanceTimersByTime(0);
    });
    expect(gallery.dataset.galleryPosition).toBe('2/3');
    expect(viewport.dataset.galleryGesture).toBe('idle');
  });
});
