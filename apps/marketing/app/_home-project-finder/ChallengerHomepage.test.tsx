import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import ChallengerHomepage from './ChallengerHomepage';

vi.mock('./ProjectFinder', () => ({ default: () => null }));
vi.mock('./ProjectFinderTracker', () => ({ default: () => null }));
vi.mock('../../components/reviews/GoogleRating', () => ({ default: () => null }));

it('discovers the actual first-screen photo eagerly with high fetch priority and responsive sizing', () => {
  document.body.innerHTML = renderToStaticMarkup(<ChallengerHomepage initialState={{}} />);
  const hero = document.querySelector<HTMLImageElement>('[class*="heroImage"] img')!;
  expect(hero).not.toBeNull();
  expect(hero.getAttribute('loading')).toBe('eager');
  expect(hero.getAttribute('fetchpriority')).toBe('high');
  expect(hero.sizes).toBe('100vw');
  expect(hero.src).toContain('project-warkworth-outdoor-room-02');
  expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
});
