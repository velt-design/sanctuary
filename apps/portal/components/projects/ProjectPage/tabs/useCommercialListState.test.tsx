import { act } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { PortalQueryClientScope } from '@/lib/react-query/PortalQueryClientContext';
import { useCommercialListScroll, useCommercialListState } from './useCommercialListState';

function List({ projectId }: { projectId: string }) {
  const [query, setQuery] = useCommercialListState(projectId, 'quotes', '');
  useCommercialListScroll(projectId, 'quotes', true);
  return <button onClick={() => setQuery('courtyard')}>{query || 'No search'}</button>;
}

describe('commercial return context', () => {
  it('restores list choices after detail and isolates projects and staff clients', () => {
    const client = new QueryClient();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const view = (projectId: string, shown = true, owner = client) => <PortalQueryClientScope client={owner}>{shown ? <List projectId={projectId} /> : <div>Detail</div>}</PortalQueryClientScope>;
    const rendered = renderIntoDocument(view('project-a'));
    act(() => rendered.container.querySelector('button')?.click());
    rendered.rerender(view('project-a', false));
    rendered.rerender(view('project-a'));
    expect(rendered.container.textContent).toBe('courtyard');
    rendered.rerender(view('project-b'));
    expect(rendered.container.textContent).toBe('No search');
    rendered.rerender(view('project-a'));
    expect(rendered.container.textContent).toBe('courtyard');
    rendered.rerender(view('project-a', true, new QueryClient()));
    expect(rendered.container.textContent).toBe('No search');
    rendered.unmount();
    scroll.mockRestore();
  });
});
