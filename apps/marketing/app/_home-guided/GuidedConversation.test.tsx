import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { projects } from '../../data/projects';
import GuidedConversation from './GuidedConversation';
import { buildGuidedHomepageMedia } from './guidedConversationMedia';

let analyticsConsent = false;
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let scrollIntoView: ReturnType<typeof vi.fn>;

vi.mock('@/components/ConsentProvider', () => ({
  useConsent: () => ({ consent: { analytics: analyticsConsent } }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: _fill,
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => <img alt={alt} {...props} />,
}));

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  analyticsConsent = false;
  window.history.replaceState({}, '', '/home-guided');
  (window as typeof window & { dataLayer?: unknown[] }).dataLayer = [];
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    value: vi.fn(),
  });
  scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  container = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function renderConversation(initialState = {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(
    <GuidedConversation
      initialState={initialState}
      media={buildGuidedHomepageMedia(projects)}
    />,
  ));
  return container;
}

async function choose(answer: string, pointer = false) {
  const option = container?.querySelector<HTMLButtonElement>(
    `[data-guided-answer="${answer}"]`,
  );
  expect(option).not.toBeNull();
  await act(async () => {
    if (pointer) {
      option?.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 1,
      }));
    } else {
      option?.click();
    }
  });
}

describe('guided conversation component', () => {
  it('renders one semantic initial question and no future branch content', async () => {
    await renderConversation();

    expect(container?.querySelector('h1')?.textContent)
      .toBe('What are you planning?');
    expect(container?.textContent).toContain('Who are you planning for?');
    expect(container?.querySelectorAll('[role="radio"]')).toHaveLength(3);
    expect(container?.querySelector('fieldset[role="radiogroup"]'))
      .not.toBeNull();
    expect(container?.textContent).not.toContain('What kind of place is it?');
    expect(container?.textContent).not.toContain('What should the roof improve most?');
    expect(container?.querySelectorAll('img')).toHaveLength(1);
  });

  it('completes a three-answer path, updates the URL and renders one result CTA', async () => {
    await renderConversation();
    await choose('home');
    expect(window.location.search).toBe('?audience=home');
    expect(container?.textContent).toContain('What are you trying to create?');
    expect(container?.textContent).toContain('My home');

    await choose('outdoor-room');
    expect(window.location.search)
      .toBe('?audience=home&goal=outdoor-room');
    expect(container?.textContent).toContain('How do you want to use the space?');

    await choose('entertaining');
    expect(window.location.search)
      .toBe('?audience=home&goal=outdoor-room&use=entertaining');
    expect(container?.querySelector('[data-guided-result="outdoor-room"]'))
      .not.toBeNull();
    expect(container?.querySelector<HTMLAnchorElement>(
      'a[href="/outdoor-rooms-auckland?use=entertaining"]',
    )?.textContent).toContain('Explore outdoor rooms');
    expect(container?.querySelector('[role="status"]')?.textContent)
      .toContain('Your best starting point is Complete outdoor room.');
  });

  it('changes an earlier answer and removes all incompatible downstream state', async () => {
    await renderConversation({
      audience: 'home',
      goal: 'outdoor-room',
      use: 'poolside',
    });

    const changeAudience = container?.querySelector<HTMLButtonElement>(
      'button[aria-label^="Change answer to question 1"]',
    );
    expect(changeAudience).not.toBeNull();
    await act(async () => changeAudience?.click());

    expect(window.location.pathname + window.location.search)
      .toBe('/home-guided');
    expect(container?.textContent).toContain('Who are you planning for?');
    expect(container?.textContent).not.toContain('Poolside use and changing weather');
    expect(document.activeElement).toBe(container?.querySelector('h1'));
  });

  it('supports Arrow, Home and End radio navigation with keyboard focus continuity', async () => {
    await renderConversation();
    const firstOption = container?.querySelector<HTMLButtonElement>(
      '[data-guided-answer="home"]',
    );
    firstOption?.focus();
    await act(async () => firstOption?.dispatchEvent(new KeyboardEvent(
      'keydown',
      { bubbles: true, cancelable: true, key: 'ArrowDown' },
    )));

    expect(window.location.search).toBe('?audience=business');
    expect(container?.textContent).toContain('What kind of place is it?');
    expect(document.activeElement).toBe(container?.querySelector('h2'));

    const firstSector = container?.querySelector<HTMLButtonElement>(
      '[data-guided-answer="hospitality"]',
    );
    firstSector?.focus();
    await act(async () => firstSector?.dispatchEvent(new KeyboardEvent(
      'keydown',
      { bubbles: true, cancelable: true, key: 'End' },
    )));
    expect(window.location.search)
      .toBe('?audience=business&sector=recreation');
  });

  it('announces each active question and restores a validated refresh state', async () => {
    window.history.replaceState(
      {},
      '',
      '/home-guided?audience=professional&stage=concept&need=not-valid&free_text=secret',
    );
    await renderConversation({ audience: 'professional', stage: 'concept' });

    expect(window.location.search)
      .toBe('?audience=professional&stage=concept');
    expect(container?.querySelector('[role="status"]')?.textContent)
      .toContain('Question 3 of 3. What do you need from Sanctuary?');
    expect(container?.textContent).not.toContain('secret');
  });

  it('removes animated scrolling for reduced-motion pointer interactions', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    await renderConversation();
    await choose('home', true);

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    });
  });

  it('emits the closed analytics contract only with analytics consent', async () => {
    analyticsConsent = true;
    await renderConversation();
    await choose('professional');

    const events = (
      (window as typeof window & { dataLayer?: Array<Record<string, unknown>> })
        .dataLayer ?? []
    );
    expect(events.map((entry) => entry.event)).toEqual([
      'guided_home_view',
      'guided_home_question_view',
      'guided_home_answer',
      'guided_home_question_view',
    ]);
    expect(events[2]).toMatchObject({
      answer_id: 'professional',
      audience: 'professional',
      homepage_variant: 'guided_design_conversation_home_v1',
      question_id: 'audience',
      source_path: '/home-guided',
      step_number: 1,
    });

    await act(async () => root?.unmount());
    root = null;
    analyticsConsent = false;
    (window as typeof window & { dataLayer?: unknown[] }).dataLayer = [];
    await renderConversation();
    await choose('home');
    expect((window as typeof window & { dataLayer?: unknown[] }).dataLayer)
      .toEqual([]);
  });
});
