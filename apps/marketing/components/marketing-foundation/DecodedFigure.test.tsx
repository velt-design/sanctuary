import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DecodedFigure from './DecodedFigure';
import RoofApproaches from './editorial/RoofApproaches';
import BlindStateGallery from '../../app/pergolas-with-blinds/BlindStateGallery';

vi.mock('next/image', () => ({ default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => <img {...props} /> }));
const acrylic = { image: '/acrylic.jpg', alt: 'Acrylic photograph', caption: 'Acrylic reference' };
const solid = { image: '/solid.jpg', alt: 'Solid photograph', caption: 'Solid reference' };
const mixed = { image: '/mixed.jpg', alt: 'Mixed photograph', caption: 'Mixed reference' };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  history.replaceState({}, '', '/');
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = (node: ReactNode) => act(async () => root.render(node));
const view = (photo: typeof acrylic) => <DecodedFigure photo={photo} sizes="100vw" />;
const shown = () => host.querySelector<HTMLImageElement>('[data-decoded-photo=shown]')!;
const incoming = () => host.querySelector<HTMLImageElement>('[data-decoded-photo=incoming]')!;
async function load(image: HTMLImageElement, decode: Promise<void>) {
  Object.defineProperty(image, 'decode', { value: () => decode });
  await act(async () => image.dispatchEvent(new Event('load')));
}

it('keeps the same opaque image and matching caption until replacement decoding completes', async () => {
  await render(view(acrylic)); const original = shown();
  await render(view(solid));
  let ready!: () => void;
  await load(incoming(), new Promise(resolve => { ready = resolve; }));
  expect(shown()).toBe(original); expect(shown().getAttribute('src')).toBe(acrylic.image);
  expect(host.querySelector('figcaption')!.textContent).toBe(acrylic.caption);
  expect(incoming().style.opacity).toBe('0'); expect(incoming().getAttribute('aria-hidden')).toBe('true');
  await act(async () => ready());
  expect(shown()).toBe(original); expect(shown().getAttribute('src')).toBe(solid.image);
  expect(shown().alt).toBe(solid.alt); expect(host.querySelector('figcaption')!.textContent).toBe(solid.caption);
  expect(incoming()).toBeNull();
});

it('retains a useful photo on error and retries only the selected replacement', async () => {
  await render(view(acrylic)); const original = shown(); await render(view(solid)); const failed = incoming();
  await act(async () => failed.dispatchEvent(new Event('error')));
  expect(shown()).toBe(original); expect(shown().getAttribute('src')).toBe(acrylic.image);
  expect(host.querySelector('figcaption')!.textContent).toContain('New photo unavailable.');
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(incoming()).not.toBe(failed); expect(shown()).toBe(original);
  await load(incoming(), Promise.resolve());
  expect(shown().getAttribute('src')).toBe(solid.image); expect(host.querySelector('button')).toBeNull();
});

it('ignores an older decode after rapid reselection and after unmount', async () => {
  await render(view(acrylic)); await render(view(solid));
  let late!: () => void; await load(incoming(), new Promise(resolve => { late = resolve; }));
  await render(view(mixed)); await load(incoming(), Promise.resolve());
  await act(async () => late()); expect(shown().getAttribute('src')).toBe(mixed.image);
  await render(view(solid)); let disposed!: () => void;
  await load(incoming(), new Promise(resolve => { disposed = resolve; }));
  await render(null); await act(async () => disposed()); expect(host.innerHTML).toBe('');
});

it('wires URL roof choices to a retained photograph instead of remounting the figure', async () => {
  await render(<RoofApproaches options={['Acrylic: Daylight', 'Solid: Shade', 'Mixed: Balance']} />);
  const original = shown(), caption = host.querySelector('figcaption')!.textContent;
  await act(async () => host.querySelector<HTMLInputElement>('input[aria-label^="02 Solid"]')!.click());
  expect(new URL(location.href).searchParams.get('roof')).toBe('solid');
  expect(shown()).toBe(original); expect(host.querySelector('figcaption')!.textContent).toBe(caption);
  await load(incoming(), Promise.resolve()); expect(host.querySelector('figcaption')!.textContent).toBe('Timber-lined ceiling reference');
});

it('wires blind state controls to the same decode owner and preserves the displayed caption', async () => {
  await render(<BlindStateGallery />); const original = shown(), caption = host.querySelector('figcaption')!.textContent;
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(shown()).toBe(original); expect(host.querySelector('figcaption')!.textContent).toBe(caption);
  await load(incoming(), Promise.resolve()); expect(host.querySelector('figcaption')!.textContent).not.toBe(caption);
});
