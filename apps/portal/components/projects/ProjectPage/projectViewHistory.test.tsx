import { act, useState, useSyncExternalStore } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { retainPortalHistory } from '../../page-state/portalHistoryGuard';
import { useProjectViewDraftGuard } from './projectViewNavigation';

const originalPush = window.history.pushState.bind(window.history);
const originalReplace = window.history.replaceState.bind(window.history);
const quoteUrl = '/staff/projects/proj_1?tab=quotes&quoteId=q1';
let cleanup: () => void;
let view: ReturnType<typeof renderIntoDocument> | undefined;
let confirm: ReturnType<typeof vi.spyOn>;
let renders: string[];
let observedPopStates: number;
let stopObserving: () => void;
let useNavigationEntries = false;
const originalNavigation = Object.getOwnPropertyDescriptor(window, 'navigation');

function Draft() {
  const [reference, setReference] = useState('');
  useProjectViewDraftGuard(reference !== '');
  return <input aria-label="Reference" value={reference} onChange={e => setReference(e.target.value)} />;
}
function Page() {
  const url = useSyncExternalStore(listener => {
    window.addEventListener('popstate', listener);
    window.addEventListener('next-history-change', listener);
    return () => {
      window.removeEventListener('popstate', listener);
      window.removeEventListener('next-history-change', listener);
    };
  }, () => window.location.pathname + window.location.search);
  renders.push(url);
  return <><output>{url}</output>{url === quoteUrl || url === `${quoteUrl}&quotePreview=1` ? <Draft key="q1" /> : null}</>;
}
function push(url: string) {
  window.history.pushState({ __NA: true, tree: ['unchanged-next-state'], application: 'retained' }, '', url);
}
function dirty() {
  act(() => {
    const input = view!.container.querySelector('input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Unsaved reference');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function traverse(direction: 'back' | 'forward' | number, expected: string) {
  await act(async () => {
    const before = observedPopStates;
    if (typeof direction === 'number') window.history.go(direction);
    else window.history[direction]();
    await vi.waitFor(() => {
      expect(observedPopStates).toBeGreaterThan(before);
      expect(window.location.pathname + window.location.search).toBe(expected);
      expect(view!.container.querySelector('output')?.textContent).toBe(expected);
    });
  });
}
beforeEach(() => {
  renders = [];
  observedPopStates = 0;
  originalReplace(null, '', '/staff/projects');
  const entries = Object.assign(new EventTarget(), { currentEntry: { index: 0 } });
  Object.defineProperty(window, 'navigation', { configurable: true, value: useNavigationEntries ? entries : undefined });
  const entryChanged = (type: string) => entries.dispatchEvent(Object.assign(new Event('currententrychange'), { navigationType: type }));
  const observe = () => {
    observedPopStates += 1;
    if (useNavigationEntries) {
      entries.currentEntry.index = window.history.state?.testIndex ?? 0;
      entryChanged('traverse');
    }
  };
  window.addEventListener('popstate', observe, { capture: true });
  stopObserving = () => window.removeEventListener('popstate', observe, { capture: true });
  // Next's native-history bridge updates React, but push/replace do not fire popstate.
  for (const [method, original] of [['pushState', originalPush], ['replaceState', originalReplace]] as const) {
    vi.spyOn(window.history, method).mockImplementation((data, unused, url) => {
      const index = entries.currentEntry.index + (method === 'pushState' ? 1 : 0);
      original(useNavigationEntries ? { ...data, testIndex: index } : data, unused, url);
      if (useNavigationEntries) {
        entries.currentEntry.index = index;
        entryChanged(method === 'pushState' ? 'push' : 'replace');
      }
      window.dispatchEvent(new Event('next-history-change'));
    });
  }
  cleanup = retainPortalHistory();
  confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
});
afterEach(() => {
  view?.unmount();view = undefined;cleanup();stopObserving();vi.restoreAllMocks();
  if (originalNavigation) Object.defineProperty(window, 'navigation', originalNavigation);
  else Reflect.deleteProperty(window, 'navigation');
  originalReplace(null, '', '/');
});

describe.each([false, true])('dirty quote and actual history traversal, navigation entries: %s', nativeEntries => {
  beforeAll(() => { useNavigationEntries = nativeEntries; });
  it.each(['/staff/projects', '/staff/projects/proj_previous?tab=overview', '/staff/projects/proj_1?tab=quotes&quoteId=q0'])(
    'cancels then confirms Back to %s without losing draft or rewriting history',
    async previous => {
      push(previous);push(quoteUrl);const length = window.history.length;
      view = renderIntoDocument(<Page />);dirty();
      await traverse('back', quoteUrl);
      expect(view.container.querySelector('input')?.value).toBe('Unsaved reference');
      expect(renders).not.toContain(previous);
      expect(confirm).toHaveBeenCalledTimes(1);
      await traverse('back', quoteUrl);
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(window.history.length).toBe(length);
      expect(window.history.state).toMatchObject({ __NA: true, tree: ['unchanged-next-state'], application: 'retained' });
      confirm.mockReturnValue(true);
      await traverse('back', previous);
      expect(confirm).toHaveBeenCalledTimes(3);
      await traverse('forward', quoteUrl);
      expect(view.container.querySelector('input')?.value).toBe('');
      expect(confirm).toHaveBeenCalledTimes(3);
      expect(window.history.length).toBe(length);
    },
  );
  it('cancels Forward, keeps the draft and can deliberately continue to the same future entry', async () => {
    push(quoteUrl);push('/staff/projects/proj_1?tab=invoices');
    view = renderIntoDocument(<Page />);
    await traverse('back', quoteUrl);dirty();
    const length = window.history.length;
    await traverse('forward', quoteUrl);
    expect(view.container.querySelector('input')?.value).toBe('Unsaved reference');
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    await traverse('forward', '/staff/projects/proj_1?tab=invoices');
    expect(view.container.querySelector('input')).toBeNull();
    expect(confirm).toHaveBeenCalledTimes(2);
    await traverse('back', quoteUrl);
    expect(view.container.querySelector('input')?.value).toBe('');
    expect(window.history.length).toBe(length);
  });
  it('retains dirty text through same-quote Details/Preview history without asking', async () => {
    push(quoteUrl);push(`${quoteUrl}&quotePreview=1`);
    view = renderIntoDocument(<Page />);dirty();
    await traverse('back', quoteUrl);
    await traverse('forward', `${quoteUrl}&quotePreview=1`);
    expect(view.container.querySelector('input')?.value).toBe('Unsaved reference');
    expect(confirm).not.toHaveBeenCalled();
  });
  it('restores a multi-entry Back without inserting history or publishing an intermediate panel', async () => {
    push('/staff/projects/proj_1?tab=estimates');push('/staff/projects/proj_1?tab=invoices');push(quoteUrl);
    view = renderIntoDocument(<Page />);dirty();
    const length = window.history.length;
    await traverse(-2, quoteUrl);
    expect(view.container.querySelector('input')?.value).toBe('Unsaved reference');
    expect(renders.every(url => url === quoteUrl)).toBe(true);
    confirm.mockReturnValue(true);
    await traverse(-2, '/staff/projects/proj_1?tab=estimates');
    expect(window.history.length).toBe(length);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
