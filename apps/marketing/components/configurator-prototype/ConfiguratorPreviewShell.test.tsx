import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ConfiguratorPreviewShell from './ConfiguratorPreviewShell';
import { rememberConfiguratorReturn } from './configuratorReturn';

const navigation = vi.hoisted(() => ({ replace: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('./ConfiguratorDialog', () => ({ default: ({ open, onClose }: { open: boolean; onClose: () => void }) => open ? <button onClick={onClose}>Close configurator</button> : null }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear(); vi.clearAllMocks();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const close = async () => { await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Close configurator')!.click()); };

it('closes to the exact recorded source even when its native fragment history entry has no router state', async () => {
  const source = '/pergolas-auckland?utm_source=synthetic#explore-options';
  window.history.replaceState(null, '', source);
  const destination = new URL('/configurator-preview?open=1&source_path=%2Fpergolas-auckland#design=example', window.location.origin);
  rememberConfiguratorReturn(destination);
  window.history.replaceState({}, '', destination);
  await act(async () => root.render(<ConfiguratorPreviewShell initiallyOpen/>));
  await close();
  expect(navigation.replace).toHaveBeenCalledWith(source, { scroll: false });
  expect(navigation.back).not.toHaveBeenCalled();
  expect(JSON.parse(sessionStorage.getItem('sanctuary.configurator-scroll.v1')!)).toMatchObject({ from: source });
});

it('keeps the validated source fallback when storage is unavailable', async () => {
  window.history.replaceState({}, '', '/configurator-preview?open=1&source_path=%2Fpergola-cost-auckland');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
  await act(async () => root.render(<ConfiguratorPreviewShell initiallyOpen/>));
  await close();
  expect(navigation.replace).toHaveBeenCalledWith('/pergola-cost-auckland');
});

it('standalone entries without a safe source close locally and can reopen', async () => {
  window.history.replaceState({}, '', '/configurator-preview?open=1&source_path=https%3A%2F%2Fexample.invalid');
  await act(async () => root.render(<ConfiguratorPreviewShell initiallyOpen/>));
  await close();
  expect(navigation.replace).not.toHaveBeenCalled(); expect(navigation.back).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(host.textContent).toContain('Close configurator');
});
