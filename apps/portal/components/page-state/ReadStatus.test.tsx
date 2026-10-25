import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import ReadStatus from './ReadStatus';

afterEach(() => { document.body.innerHTML = ''; });

it('keeps one local status owner while error details open outside the work flow and Retry stays immediately available', () => {
  const retry = vi.fn();
  const view = renderIntoDocument(<ReadStatus title="Reading projects…" />);
  const status = view.container.firstElementChild;
  view.rerender(<ReadStatus title="Refresh failed" tone="error" action={<button onClick={retry}>Retry</button>}
    details={<p>The current read failed. Saved records remain available.</p>} />);
  expect(view.container.firstElementChild).toBe(status);
  expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('Refresh failed');
  const buttons = Array.from(view.container.querySelectorAll('button'));
  act(() => buttons.find(button => button.textContent === 'Retry')!.click());
  expect(retry).toHaveBeenCalledOnce();
  const details = buttons.find(button => button.textContent === 'Details')!;
  act(() => { details.focus(); details.click(); });
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('Saved records remain available');
  expect(view.container.contains(dialog)).toBe(false);
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(details);
  view.rerender(<ReadStatus title="12 projects" />);
  expect(view.container.firstElementChild).toBe(status);
  expect(view.container.textContent).toBe('12 projects');
  view.unmount();
});
