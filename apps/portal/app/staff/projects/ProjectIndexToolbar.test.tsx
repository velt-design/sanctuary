import { useState } from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectIndexToolbar from './ProjectIndexToolbar';
import { parseProjectIndexView } from './projectIndexView';

let rendered: ReturnType<typeof renderIntoDocument>;
afterEach(() => { rendered?.unmount(); vi.restoreAllMocks(); });
const click = (text: string) => act(() => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.trim() === text)!.click());
const change = (id: string, value: string) => act(() => { const field = document.querySelector<HTMLSelectElement>(`#${id}`)!; field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); });
function Harness() {
  const [view, setView] = useState(parseProjectIndexView(new URLSearchParams('page=3')));
  return <><ProjectIndexToolbar view={view} onChange={(patch) => setView({ ...view, page: 1, ...patch })} onReset={() => setView(parseProjectIndexView(new URLSearchParams()))} /><output>{JSON.stringify(view)}</output></>;
}

describe('Projects filter drawer', () => {
  it('cancels drafts and applies the complete selection atomically before removing it', () => {
    rendered = renderIntoDocument(<Harness />);
    click('Filters'); change('projectStateFilter', 'ARCHIVED'); change('projectOwnerFilter', 'jordan'); click('Cancel');
    expect(document.querySelector('output')?.textContent).toContain('"page":3');
    expect(document.querySelector('output')?.textContent).toContain('"archiveFilter":"active"');
    click('Filters'); change('projectStateFilter', 'ARCHIVED'); change('projectOwnerFilter', 'jordan');
    act(() => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(document.querySelector('output')?.textContent).toContain('"archiveFilter":"archived"');
    expect(document.querySelector('output')?.textContent).toContain('"ownerFilter":"jordan"');
    expect(document.querySelector('output')?.textContent).toContain('"page":1');
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Remove state filter"]')!.click());
    expect(document.querySelector('output')?.textContent).toContain('"archiveFilter":"active"');
    expect(document.querySelector('output')?.textContent).toContain('"ownerFilter":"jordan"');
    click('Clear all'); expect(document.querySelector('output')?.textContent).toContain('"ownerFilter":"all"');
  });
  it('discards a draft on Escape without changing saved list choices', () => {
    rendered = renderIntoDocument(<Harness />);
    click('Filters'); change('projectJourneyFilter', 'PROPOSAL');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('output')?.textContent).toContain('"journeyFilter":"all"');
  });
});
