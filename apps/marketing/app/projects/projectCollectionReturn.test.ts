import type { MouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCollectionReturnImageWarm, readCollectionLinkReturn, readCollectionReturn, restoreCollectionScroll, saveCollectionReturn } from './projectCollectionReturn';

function clickProject(modified = false) {
  const anchor = document.createElement('a');
  anchor.href = '/projects/dairy-flat-estate';
  saveCollectionReturn({ target: anchor, button: 0, ctrlKey: modified } as unknown as MouseEvent<HTMLElement>);
}

afterEach(() => {
  document.querySelectorAll('[data-project-card]').forEach(el => el.remove());
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
    vi.stubGlobal('scrollY', 0);
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    restoreCollectionScroll(saved!.scrollY);
    expect(windowScroll).toHaveBeenCalledWith({ top: 750, behavior: 'instant' });
  });

  it('leaves an already restored scroll owner untouched', () => {
    vi.stubGlobal('scrollY', 750);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    restoreCollectionScroll(750);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('reserves collection fallback for an explicit link, not a revisited entry', () => {
    window.history.replaceState({}, '', '/projects?audience=residential');
    vi.stubGlobal('scrollY', 750);
    clickProject();
    const collectionEntry = window.history.state;
    window.history.replaceState({}, '', '/projects/dairy-flat-estate');
    readCollectionReturn();
    const anchor = document.createElement('a'); anchor.href = '/projects?audience=residential';
    saveCollectionReturn({ target: anchor, button: 0 } as unknown as MouseEvent<HTMLElement>);
    window.history.replaceState({}, '', '/projects?audience=residential');
    expect(readCollectionLinkReturn()).toEqual({ href: '/projects?audience=residential', scrollY: 750 });
    window.history.replaceState(collectionEntry, '', '/projects?audience=residential');
    expect(readCollectionLinkReturn()).toBeNull();
    expect(readCollectionReturn()?.scrollY).toBe(750);
  });

  it('prioritizes only already loaded thumbnails in the departing viewport', () => {
    window.history.replaceState({}, '', '/projects');
    for (const [slug, top, decoded] of [['visible', 100, true], ['offscreen', 1600, true], ['pending', 200, false]] as const) {
      const card = document.createElement('a'); card.dataset.projectCard = slug;
      const image = document.createElement('img'); card.append(image); document.body.append(card);
      vi.spyOn(image, 'complete', 'get').mockReturnValue(decoded);
      vi.spyOn(image, 'naturalWidth', 'get').mockReturnValue(decoded ? 350 : 0);
      vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + 400, left: 20, right: 370 } as DOMRect);
    }
    clickProject();
    expect(isCollectionReturnImageWarm('visible')).toBe(true);
    expect(isCollectionReturnImageWarm('offscreen')).toBe(false);
    expect(isCollectionReturnImageWarm('pending')).toBe(false);
  });
});
