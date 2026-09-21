import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ConfiguratorDialog from './ConfiguratorDialog';

vi.mock('./ConfiguratorPrototype', () => ({ default: () => <p>Design controls</p> }));
vi.mock('./usePreviewExpansion', () => ({ usePreviewExpansion: () => ({ expanded: false, toggleExpanded() {}, collapse() {} }) }));

it('releases the background before a close callback can navigate, and safely cleans up again', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const onClose = vi.fn(() => { expect(document.body.style.position).toBe(''); expect(scroll).toHaveBeenCalled(); });
  await act(async () => root.render(<ConfiguratorDialog open onClose={onClose}/>));
  expect(document.body.style.position).toBe('fixed');
  await act(async () => host.querySelector('button')!.click());
  expect(onClose).toHaveBeenCalledOnce();
  const releases = scroll.mock.calls.length;
  await act(async () => root.unmount());
  expect(scroll.mock.calls.length).toBe(releases);
  host.remove(); vi.restoreAllMocks();
});
