import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { FoundationClarityExample } from './FoundationClarityExample';

let rendered: ReturnType<typeof renderIntoDocument>;
const button = (name: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.trim() === name)!;
const click = (name: string) => act(() => button(name).click());
const change = (selector: string, value: string) => act(() => {
  const field = document.querySelector<HTMLSelectElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event('change', { bubbles: true }));
});
const count = () => document.querySelector('[aria-label="Example supporting enquiries"] tbody')?.children.length ?? 0;

describe('Foundation clarity journey', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    window.localStorage.clear();
    rendered = renderIntoDocument(<FoundationClarityExample />);
  });
  afterEach(() => { rendered.unmount(); vi.restoreAllMocks(); });
  it('does not apply draft filters on cancellation and restores record context', () => {
    click('Filters'); change('[role="dialog"] select', 'Unknown'); click('Cancel');
    expect(count()).toBe(12);
    click('Filters');
    const dialog = document.querySelector('[role="dialog"]')!;
    const select = dialog.querySelector('select')!;
    act(() => { select.value = 'Unknown'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    act(() => dialog.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(count()).toBe(3);
    click('Example enquiry 03');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('DEMO-03');
    click('Back to records'); expect(count()).toBe(3);
  });
  it('keeps failed data unavailable and retries without losing the selected source', () => {
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Meta: 3 enquiries"]')!.click());
    change('[aria-label="Example data state"]', 'unavailable');
    expect(document.querySelector('[aria-label="Example enquiry summary"]')?.textContent).toContain('Unavailable');
    expect(count()).toBe(0);
    click('Retry'); expect(count()).toBe(3);
    expect(document.querySelector('[aria-label="Example applied filters"]')?.textContent).toContain('Meta');
  });
  it('restores saved preferences after remount without storing records', () => {
    change('[aria-label="Example date range"]', '7');
    click('Saved view'); click('Save current view');
    expect(window.localStorage.getItem('sanctuary:foundation:example-view:v1')).toBe('{"days":"7","source":""}');
    rendered.unmount(); rendered = renderIntoDocument(<FoundationClarityExample />);
    click('Saved view'); click('Restore saved view: 7 days, all sources'); expect(count()).toBe(4);
  });
});

