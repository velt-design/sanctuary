import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ScheduleViewTabs from './ScheduleViewTabs';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ScheduleViewTabs', () => {
  it('keeps Site Visits hidden while preserving Board and Gantt navigation', () => {
    const onChange = vi.fn();
    const rendered = renderIntoDocument(
      <ScheduleViewTabs view="site_visits" onChange={onChange} />,
    );
    const buttons = Array.from(rendered.container.querySelectorAll('button'));

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Board', 'Gantt']);

    act(() => {
      buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('board', buttons[0]);

    rendered.unmount();
  });
});
