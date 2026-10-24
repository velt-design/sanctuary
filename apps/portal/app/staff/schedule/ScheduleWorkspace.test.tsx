import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { ScheduleWorkspace, useScheduleWorkspace } from './ScheduleWorkspace';

const router = { replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
function PublicDate() {
  const workspace = useScheduleWorkspace();
  return <output>{workspace?.today}</output>;
}
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

it('uses the current Auckland day for a new entry and keeps it through that entry’s guarded handoff', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T10:59:59Z'));
  const entry = {};
  const ui = (identity: object | string, owner: object | null) => <ScheduleWorkspace
    visible={false} owner={owner} entryIdentity={identity}><PublicDate /></ScheduleWorkspace>;
  const view = renderIntoDocument(ui('/dashboard', null));
  expect(view.container.textContent).toBe('2026-10-23');
  act(() => { vi.advanceTimersByTime(2000); });
  view.rerender(ui(entry, null));
  expect(view.container.textContent).toBe('2026-10-24');
  act(() => { vi.advanceTimersByTime(86400000); });
  view.rerender(ui(entry, {}));
  expect(view.container.textContent).toBe('2026-10-24');
  view.rerender(ui({}, null));
  expect(view.container.textContent).toBe('2026-10-25');
  view.unmount();
});
