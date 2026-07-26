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
    expect(gallery.querySelectorAll('img')).toHaveLength(1);
    expect(document.activeElement).toBe(next);
  });

  it('supports intentional horizontal touch swipes without treating vertical movement as navigation', async () => {
    const container = await render(
      <ResponsiveGallery label="Completed projects" items={galleryItems} swipe />,
    );
    const gallery = container.querySelector('[data-responsive-gallery]') as HTMLElement;
    const viewport = gallery.firstElementChild as HTMLElement;
    const dispatchPointer = (
      type: 'pointerdown' | 'pointerup',
      clientX: number,
      clientY: number,
    ) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        clientX: { value: clientX },
        clientY: { value: clientY },
        pointerId: { value: 1 },
        pointerType: { value: 'touch' },
      });
      viewport.dispatchEvent(event);
    };

    expect(gallery.dataset.gallerySwipe).toBe('true');
    await act(async () => {
      dispatchPointer('pointerdown', 300, 200);
      dispatchPointer('pointerup', 180, 205);
    });
    expect(gallery.dataset.galleryPosition).toBe('2/3');

    await act(async () => {
      dispatchPointer('pointerdown', 200, 100);
      dispatchPointer('pointerup', 190, 220);
    });
    expect(gallery.dataset.galleryPosition).toBe('2/3');

    await act(async () => {
      dispatchPointer('pointerdown', 180, 200);
      dispatchPointer('pointerup', 300, 205);
    });
    expect(gallery.dataset.galleryPosition).toBe('1/3');
  });
});
