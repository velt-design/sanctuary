import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertBanner, DataStatePanel, FinancialSummary, PermissionBlockedControl, TaskScheduleFeedback } from './FoundationFeedback';
import { SearchFilterBar } from './SearchFilterBar';
import { SelectionTable } from './SelectionTable';
import { renderIntoDocument } from '../../../../../test/reactHarness';

vi.mock('next/link', () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));

describe('production foundation patterns', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('updates search, filter chips, and clear-all through controlled callbacks', () => {
    const onQueryChange = vi.fn();
    const onStageChange = vi.fn();
    const onClearAll = vi.fn();
    const rendered = renderIntoDocument(<SearchFilterBar query="deck" onQueryChange={onQueryChange} searchId="projectSearch" filters={[{ id: 'stage', label: 'Stage', value: 'sent', onChange: onStageChange, options: [{ value: 'all', label: 'All' }, { value: 'sent', label: 'Sent' }] }]} onClearAll={onClearAll} />);
    const input = rendered.container.querySelector('#projectSearch') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'roof');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onQueryChange).toHaveBeenCalledWith('roof');
    expect(rendered.container.textContent).toContain('Stage: Sent');
    const clearAll = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Clear all') as HTMLButtonElement;
    act(() => clearAll.click());
    expect(onClearAll).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it('supports row selection, expansion, overflow actions, and bulk state', () => {
    const rendered = renderIntoDocument(<SelectionTable columns={['Project']} rows={[{ id: 'p1', label: 'Remuera', cells: ['Remuera'], expandedContent: 'Details', actions: [{ label: 'Archive' }] }]} />);
    const select = rendered.container.querySelector('input[aria-label="Select Remuera"]') as HTMLInputElement;
    act(() => select.click());
    expect(rendered.container.textContent).toContain('1 selected');
    const expand = rendered.container.querySelector('button[aria-label="Expand Remuera"]') as HTMLButtonElement;
    act(() => expand.click());
    expect(rendered.container.textContent).toContain('Details');
    expect(rendered.container.querySelector('button[aria-label="More actions"]')).not.toBeNull();
    rendered.unmount();
  });

  it('renders non-colour status semantics, permissions, and NZ financial formatting', () => {
    const rendered = renderIntoDocument(<div>
      <AlertBanner tone="error" title="Refresh failed">Cached data remains visible.</AlertBanner>
      <DataStatePanel state="conflict" />
      <PermissionBlockedControl label="Approve quote" reason="Admin permission required" />
      <TaskScheduleFeedback state="blocked">Schedule conflict</TaskScheduleFeedback>
      <FinancialSummary revenue={78940} cost={45200} />
    </div>);
    expect(rendered.container.querySelectorAll('[role="alert"]')).toHaveLength(3);
    expect((rendered.container.querySelector('button[disabled]') as HTMLButtonElement).disabled).toBe(true);
    expect(rendered.container.textContent).toContain('$78,940');
    expect(rendered.container.textContent).toContain('42.7%');
    rendered.unmount();
  });
});
