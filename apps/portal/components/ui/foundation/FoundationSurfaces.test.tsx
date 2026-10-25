import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card, EmptyState, LoadingSkeleton, PageLayout, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './FoundationSurfaces';
import { Pagination } from './FoundationPagination';
import { renderIntoDocument } from '../../../../../test/reactHarness';

describe('foundation surfaces', () => {
  it('retains real pager buttons disabled for an unknown count, then enables the same controls for a checked page', () => {
    const change = vi.fn();
    const view = renderIntoDocument(<Pagination compact currentPage={2} totalPages={null} onPageChange={change} />);
    const previous = view.container.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')!;
    const next = view.container.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!;
    expect(previous.disabled).toBe(true); expect(next.disabled).toBe(true);
    expect(view.container.querySelector('[aria-label="Page 1"]')).toBeNull();
    act(() => next.click()); expect(change).not.toHaveBeenCalled();
    view.rerender(<Pagination compact currentPage={2} totalPages={3} onPageChange={change} itemSummary="51–100 of 140" />);
    expect(view.container.querySelector('[aria-label="Previous page"]')).toBe(previous);
    expect(view.container.querySelector('[aria-label="Next page"]')).toBe(next);
    expect(next.disabled).toBe(false); act(() => next.click()); expect(change).toHaveBeenCalledWith(3);
    view.rerender(<Pagination compact currentPage={2} totalPages={null} disabled onPageChange={change} />);
    expect(next.disabled).toBe(true); expect(next.isConnected).toBe(true);
    view.unmount();
  });
  it('keeps the same native table when its route owns a bounded reading viewport', () => {
    const view = renderIntoDocument(<Table viewportClassName="route-viewport"><TableBody><TableRow><TableCell>Reading…</TableCell></TableRow></TableBody></Table>);
    const table = view.container.querySelector('table')!;
    expect(table.parentElement?.classList.contains('route-viewport')).toBe(true);
    expect(table.hasAttribute('viewportClassName')).toBe(false);
    view.rerender(<Table viewportClassName="route-viewport"><TableBody><TableRow><TableCell>Current record</TableCell></TableRow></TableBody></Table>);
    expect(view.container.querySelector('table')).toBe(table);
    expect(table.textContent).toBe('Current record');
    view.unmount();
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('preserves heading and native table semantics', () => {
    const rendered = renderIntoDocument(<div>
      <Card title="Pipeline" headingLevel={3}><p>Body</p></Card>
      <Table><TableHeader><TableRow><TableHead>Project</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Remuera</TableCell></TableRow></TableBody></Table>
      <EmptyState title="No projects" headingLevel={2} />
    </div>);
    expect(rendered.container.querySelector('h3')?.textContent).toBe('Pipeline');
    expect(rendered.container.querySelector('h2')?.textContent).toBe('No projects');
    expect(rendered.container.querySelector('table thead th')?.textContent).toBe('Project');
    rendered.unmount();
  });

  it('provides the shared route canvas and density contract', () => {
    const rendered = renderIntoDocument(<PageLayout density="compact" data-route="contacts">Content</PageLayout>);
    const main = rendered.container.querySelector('main');
    expect(main?.dataset.uiDensity).toBe('compact');
    expect(main?.dataset.route).toBe('contacts');
    expect(main?.textContent).toBe('Content');
    rendered.unmount();
  });

  it('keeps skeleton dimensions stable and pagination bounded', () => {
    const onPageChange = vi.fn();
    const rendered = renderIntoDocument(<div><LoadingSkeleton rows={3} columns={2} /><Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} /></div>);
    expect(rendered.container.querySelectorAll('[role="status"] > div')).toHaveLength(3);
    expect(rendered.container.querySelectorAll('[role="status"] > div:first-child > span')).toHaveLength(2);
    const next = rendered.container.querySelector('button[aria-label="Next page"]') as HTMLButtonElement;
    act(() => next.click());
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect((rendered.container.querySelector('button[aria-label="Previous page"]') as HTMLButtonElement).disabled).toBe(true);
    rendered.unmount();
  });
});
