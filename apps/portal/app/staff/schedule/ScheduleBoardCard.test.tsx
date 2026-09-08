import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import JobCardShell from './ScheduleBoardCard';

describe('Board card surface', () => {
  it('keeps job identity, timing and the dedicated move control together', () => {
    const html = renderToStaticMarkup(<JobCardShell
      dragId="sample" title="Pergola" identityDetail="Alex · Auckland" descriptor=""
      statusLabel="Deposit" durationLabel="3d" durationTitle="24h" dateLine="10–12 Sep"
      scheduleStatus="TENTATIVE" pinned draggable cardRef={() => {}} sequencePosition={2}
    />);
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.textContent).toContain('Alex · Auckland');
    expect(container.textContent).toContain('10–12 Sep');
    expect(container.textContent).toContain('Timing: Pinned');
    expect(container.querySelector('[aria-label="Move Pergola"]')).not.toBeNull();
    expect(container.querySelector('[data-schedule-position="2"]')).not.toBeNull();
  });
});
