import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { ScheduleBoardActions } from './ScheduleBoardActions';

describe('ScheduleBoardActions', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('groups job commands by intent and returns focus after Escape', async () => {
    const invoked = vi.fn();
    const rendered = renderIntoDocument(
      <ScheduleBoardActions
        projectName="Alpha Deck"
        actions={[
          { label: 'Set duration…', group: 'timing', onClick: invoked },
          { label: 'Mark in progress', group: 'progress', onClick: invoked },
          { label: 'Mark client contacted', group: 'client', onClick: invoked },
          { label: 'Unschedule', group: 'exceptions', tone: 'danger', onClick: invoked },
        ]}
      />,
    );
    const trigger = rendered.container.querySelector('button') as HTMLButtonElement;

    act(() => trigger.click());
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLDivElement;
    expect(dialog.getAttribute('aria-label')).toBe('Job actions for Alpha Deck');
    expect(dialog.textContent).toContain('Plan and timing');
    expect(dialog.textContent).toContain('Job progress');
    expect(dialog.textContent).toContain('Customer');
    expect(dialog.textContent).toContain('Exceptions');
    expect(dialog.querySelector('[role="menuitem"]')).toBeNull();

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await act(async () => Promise.resolve());
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    rendered.unmount();
  });

  it('prevents opening commands while another schedule change is active', () => {
    const rendered = renderIntoDocument(
      <ScheduleBoardActions
        projectName="Alpha Deck"
        disabled
        disabledReason="Another schedule change is still saving."
        actions={[{ label: 'Unschedule', group: 'exceptions', onClick: vi.fn() }]}
      />,
    );
    const trigger = rendered.container.querySelector('button') as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(trigger.title).toBe('Another schedule change is still saving.');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    rendered.unmount();
  });
});
