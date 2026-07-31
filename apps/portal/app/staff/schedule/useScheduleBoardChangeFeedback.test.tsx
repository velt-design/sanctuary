import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { scheduleBoardChangeLabel, useScheduleBoardChangeFeedback } from './useScheduleBoardChangeFeedback';

function FeedbackHarness() {
  const [trust, setTrust] = useState<'saved' | 'refreshing'>('refreshing');
  const feedback = useScheduleBoardChangeFeedback(trust);
  return (
    <div>
      <button type="button" onClick={() => feedback.begin({ projectId: 'proj-a', action: 'Move', destination: 'Crew Bravo' })}>
        Begin
      </button>
      <button type="button" onClick={() => feedback.change && feedback.setPhase(feedback.change.id, 'reconciling')}>
        Reconcile
      </button>
      <button type="button" onClick={() => setTrust('saved')}>Authoritative</button>
      <output>{feedback.change ? scheduleBoardChangeLabel(feedback.change) : 'clear'}</output>
    </div>
  );
}

describe('useScheduleBoardChangeFeedback', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps ambiguous changes visible until authoritative schedule truth verifies them', async () => {
    vi.useFakeTimers();
    const rendered = renderIntoDocument(<FeedbackHarness />);
    const buttons = rendered.container.querySelectorAll('button');

    act(() => buttons[0].click());
    expect(rendered.container.querySelector('output')?.textContent).toBe('Checking move…');
    act(() => buttons[1].click());
    expect(rendered.container.querySelector('output')?.textContent).toBe('Checking saved schedule…');
    act(() => buttons[2].click());
    await act(async () => Promise.resolve());
    expect(rendered.container.querySelector('output')?.textContent).toBe('Schedule verified');
    act(() => vi.advanceTimersByTime(3200));
    expect(rendered.container.querySelector('output')?.textContent).toBe('clear');
    rendered.unmount();
  });
});
