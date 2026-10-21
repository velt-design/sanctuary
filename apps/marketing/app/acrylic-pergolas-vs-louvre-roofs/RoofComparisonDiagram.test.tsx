import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, expect, it } from 'vitest';
import RoofComparisonDiagram from './RoofComparisonDiagram';

let root: Root | undefined;
beforeAll(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; });

it('changes only the louvre illustration, retaining every blade and the fixed roof', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<RoofComparisonDiagram />));
  expect(container.querySelector('h3')?.parentElement?.textContent).toContain('Sanctuary');
  expect(container.querySelectorAll('h3')[1].parentElement?.textContent).toContain('Other suppliers');
  const [fixed, moving] = [...container.querySelectorAll('svg')];
  const fixedMarkup = fixed.outerHTML;
  const openMarkup = moving.outerHTML;
  const [open, closed] = [...container.querySelectorAll('button')];
  expect(moving.querySelectorAll('[data-roof-blade]')).toHaveLength(7);
  expect(moving.textContent).toContain('They remain above the frame');
  closed.focus();
  await act(async () => closed.click());
  expect(document.activeElement).toBe(closed);
  expect(closed.getAttribute('aria-pressed')).toBe('true');
  expect(open.getAttribute('aria-pressed')).toBe('false');
  expect(moving.outerHTML).not.toBe(openMarkup);
  expect(moving.querySelectorAll('[data-roof-blade]')).toHaveLength(7);
  expect(moving.textContent).toContain('Solid tilting blades, closed');
  expect(fixed.outerHTML).toBe(fixedMarkup);
  await act(async () => open.click());
  expect(moving.outerHTML).toBe(openMarkup);
  expect(container.textContent).toContain('Other materials and retracting systems differ.');
});
