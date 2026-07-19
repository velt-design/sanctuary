import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import WorkbenchChrome from './WorkbenchChrome';

const preloadWorkbenchViewport = vi.fn();

vi.mock('./workbenchViewportModules', () => ({
  preloadWorkbenchViewport: (...args: unknown[]) => preloadWorkbenchViewport(...args),
}));

function buttonByName(container: HTMLElement, name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${name}`);
  return button;
}

describe('WorkbenchChrome viewport intent', () => {
  beforeEach(() => preloadWorkbenchViewport.mockReset());
  afterEach(() => { document.body.innerHTML = ''; });

  it.each([
    ['hover', 'mouseover'],
    ['focus', 'focusin'],
    ['pointer down', 'pointerdown'],
    ['touch', 'touchstart'],
  ])('preloads 3D on %s', (_intent, eventName) => {
    const rendered = renderIntoDocument(
      <WorkbenchChrome viewportMode="sheet" onViewportModeChange={() => undefined} />,
    );

    act(() => {
      buttonByName(rendered.container, '3D Review').dispatchEvent(
        new Event(eventName, { bubbles: true, cancelable: true }),
      );
    });

    expect(preloadWorkbenchViewport).toHaveBeenCalledWith('geometry3d');
    rendered.unmount();
  });

  it('does not preload 3D for Plan or Sheet intent', () => {
    const rendered = renderIntoDocument(
      <WorkbenchChrome viewportMode="sheet" onViewportModeChange={() => undefined} />,
    );

    act(() => {
      buttonByName(rendered.container, 'Plan Editor').dispatchEvent(new Event('mouseover', { bubbles: true }));
      buttonByName(rendered.container, 'Sheet Output').dispatchEvent(new Event('focusin', { bubbles: true }));
    });

    expect(preloadWorkbenchViewport).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
