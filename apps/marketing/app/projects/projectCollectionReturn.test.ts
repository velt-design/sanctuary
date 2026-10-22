import type { MouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCollectionReturn, restoreCollectionScroll, saveCollectionReturn } from './projectCollectionReturn';

function clickProject(modified = false) {
  const anchor = document.createElement('a');
  anchor.href = '/projects/dairy-flat-estate';
  saveCollectionReturn({ target: anchor, button: 0, ctrlKey: modified } as unknown as MouseEvent<HTMLElement>);
}

afterEach(() => {
  document.body.removeAttribute('style');
  document.body.scrollTop = 0;
  delete (document.body as Partial<HTMLElement>).scrollTo;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/projects');
  readCollectionReturn();
});

describe('collection scroll return', () => {
  it('restores the lower card when BODY scrolls and the window remains at zero', () => {
    window.history.replaceState({ nextTree: 'retained' }, '', '/projects?audience=residential&form=gable');
    vi.stubGlobal('scrollY', 0);
    document.body.style.overflowY = 'auto';
    vi.spyOn(document.body, 'clientHeight', 'get').mockReturnValue(844);
    vi.spyOn(document.body, 'scrollHeight', 'get').mockReturnValue(2600);
    document.body.scrollTop = 1280.5;
    clickProject();
    const saved = readCollectionReturn();
    expect(saved).toEqual({ href: '/projects?audience=residential&form=gable', scrollY: 1280.5 });
    expect(window.history.state.nextTree).toBe('retained');
    document.body.scrollTop = 0;
    const bodyScroll = vi.fn(); document.body.scrollTo = bodyScroll;
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    restoreCollectionScroll(saved!.scrollY);
    expect(bodyScroll).toHaveBeenCalledWith({ top: 1280.5, behavior: 'instant' });
    expect(windowScroll).not.toHaveBeenCalled();
  });

  it('preserves document scrolling and ignores modified project links', () => {
    window.history.replaceState(null, '', '/projects?audience=residential');
    vi.stubGlobal('scrollY', 750);
    clickProject(true);
    expect(readCollectionReturn()).toBeNull();
    clickProject();
    const saved = readCollectionReturn();
    expect(saved?.scrollY).toBe(750);
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    restoreCollectionScroll(saved!.scrollY);
    expect(windowScroll).toHaveBeenCalledWith({ top: 750, behavior: 'instant' });
  });
});
