import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card, EmptyState, LoadingSkeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './FoundationSurfaces';
import { Pagination } from './FoundationPagination';
import { renderIntoDocument } from '../../../../../test/reactHarness';

describe('foundation surfaces', () => {
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
