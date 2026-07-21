import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchKeyboard, renderIntoDocument } from '../../../../../test/reactHarness';
import {
  ActionPanel,
  ActivityTimeline,
  ActivityTimelineItem,
  KeyValueGrid,
  MetricGrid,
  TabNavigation,
  TaskList,
  TaskRow,
} from './FoundationOperational';

describe('foundation operational patterns', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('provides keyboard-selectable tabs with one roving tab stop', () => {
    const onSelect = vi.fn();
    const rendered = renderIntoDocument(
      <TabNavigation
        ariaLabel="Project sections"
        items={[{ key: 'overview', label: 'Overview' }, { key: 'commercial', label: 'Commercial' }]}
        selectedKey="overview"
        onSelect={onSelect}
      />,
    );
    const tabs = rendered.container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs[0].tabIndex).toBe(0);
    expect(tabs[1].tabIndex).toBe(-1);
    dispatchKeyboard(tabs[0], 'ArrowRight');
    expect(onSelect).toHaveBeenCalledWith('commercial');
    expect(document.activeElement).toBe(tabs[1]);
  });

  it('renders semantic key-value, metric, timeline, and task structures', () => {
    const onChange = vi.fn();
    const rendered = renderIntoDocument(
      <>
        <KeyValueGrid ariaLabel="Project metadata" items={[{ label: 'Owner', value: 'Jordan' }]} />
        <MetricGrid ariaLabel="Commercial summary" items={[{ label: 'Price', value: '$12,000', detail: 'inc GST' }]} />
        <ActivityTimeline><ActivityTimelineItem meta="Today">Called client</ActivityTimelineItem></ActivityTimeline>
        <TaskList><TaskRow checked={false} label="Call client" controlAriaLabel="Complete Call client" onChange={onChange} /></TaskList>
        <ActionPanel title="Call the client" eyebrow="Next action" tone="inverse">Due today</ActionPanel>
      </>,
    );
    expect(rendered.container.querySelector('dl[aria-label="Project metadata"] dt')?.textContent).toBe('Owner');
    expect(rendered.container.querySelector('dl[aria-label="Commercial summary"] dd')?.textContent).toBe('$12,000');
    expect(rendered.container.querySelector('ol[aria-label="Activity timeline"]')?.textContent).toContain('Called client');
    expect(rendered.container.querySelector('input[aria-label="Complete Call client"]')).not.toBeNull();
    act(() => rendered.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(onChange).toHaveBeenCalledWith(true);
    expect(rendered.container.querySelector('section[data-tone="inverse"]')?.textContent).toContain('Call the client');
  });
});
