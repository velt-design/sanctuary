import { describe, expect, it } from 'vitest';
import {
  buildProjectDetailHistoryState,
  getProjectDetailSlug,
  getProjectHeroPreloadUrl,
  shouldUseInPlaceProjectNavigation,
  shouldPreserveProjectDetailScroll,
} from './projectDetailNavigation';

describe('desktop project detail navigation', () => {
  it('recognizes canonical project detail paths only', () => {
    expect(getProjectDetailSlug('/projects/dairy-flat-estate')).toBe('dairy-flat-estate');
    expect(getProjectDetailSlug('/projects/dairy-flat-estate/')).toBe('dairy-flat-estate');
    expect(getProjectDetailSlug('/projects')).toBeNull();
    expect(getProjectDetailSlug('/products/pergolas/gable')).toBeNull();
  });

  it('preserves scroll only for marked project-to-project history entries', () => {
    const state = buildProjectDetailHistoryState({ framework: 'retained' }, 'dairy-flat-estate');

    expect(state.framework).toBe('retained');
    expect(shouldPreserveProjectDetailScroll(
      '/projects/goodhome-commercial-terrace',
      '/projects/dairy-flat-estate',
      state,
    )).toBe(true);
    expect(shouldPreserveProjectDetailScroll(
      '/contact',
      '/projects/dairy-flat-estate',
      state,
    )).toBe(false);
    expect(shouldPreserveProjectDetailScroll(
      '/projects/goodhome-commercial-terrace',
      '/projects/dairy-flat-estate',
      null,
    )).toBe(false);
  });

  it('does not copy private Next router markers that bypass its History API wrapper', () => {
    expect(buildProjectDetailHistoryState({
      __NA: true,
      _N: true,
      __PRIVATE_NEXTJS_INTERNALS_TREE: ['projects'],
      retained: 'value',
    }, 'dairy-flat-estate')).toEqual({
      retained: 'value',
      __sanctuaryProjectDetailSlug: 'dairy-flat-estate',
    });
  });

  it('enhances only unmodified primary clicks on desktop', () => {
    const primaryClick = {
      altKey: false,
      button: 0,
      ctrlKey: false,
      currentTarget: { target: '' },
      metaKey: false,
      shiftKey: false,
    };

    expect(shouldUseInPlaceProjectNavigation(primaryClick, true)).toBe(true);
    expect(shouldUseInPlaceProjectNavigation(primaryClick, false)).toBe(false);
    expect(shouldUseInPlaceProjectNavigation({
      ...primaryClick,
      ctrlKey: true,
    }, true)).toBe(false);
    expect(shouldUseInPlaceProjectNavigation({
      ...primaryClick,
      metaKey: true,
    }, true)).toBe(false);
    expect(shouldUseInPlaceProjectNavigation({
      ...primaryClick,
      currentTarget: { target: '_blank' },
    }, true)).toBe(false);
  });

  it('reuses the active Next image width and quality for the incoming hero', () => {
    expect(getProjectHeroPreloadUrl(
      '/images/project-dairy-flat-01.jpg',
      'https://example.test/_next/image?url=%2Fimages%2Fproject-goodhome-03.jpg&w=1200&q=75',
      'https://example.test',
    )).toBe(
      'https://example.test/_next/image?url=%2Fimages%2Fproject-dairy-flat-01.jpg&w=1200&q=75',
    );
    expect(getProjectHeroPreloadUrl(
      '/images/project-dairy-flat-01.jpg',
      '/images/project-goodhome-03.jpg',
      'https://example.test',
    )).toBe('https://example.test/images/project-dairy-flat-01.jpg');
  });
});
