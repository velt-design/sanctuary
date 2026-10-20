import { act } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { PortalQueryClientScope } from '@/lib/react-query/PortalQueryClientContext';
import { useCommercialListScroll, useCommercialListState } from './useCommercialListState';

function List({ projectId, section = 'quotes' }: { projectId: string; section?: string }) {
  const [query, setQuery] = useCommercialListState(projectId, 'quotes', '');
  useCommercialListScroll(projectId, section, true);
  return <button onClick={() => setQuery('courtyard')}>{query || 'No search'}</button>;
}

describe('commercial return context', () => {
  it('restores detail return scroll but never applies another commercial tab old scroll after its load', () => {
    const client = new QueryClient();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const frames: FrameRequestCallback[] = [];
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.push(callback); return frames.length; });
    client.setQueryData(['commercialListView', 'project-a', 'quotes-scroll'], 700);
    client.setQueryData(['commercialListView', 'project-a', 'active-section'], 'invoices');
    const view = (section: string, shown = true) => <PortalQueryClientScope client={client}>{shown ? <List projectId="project-a" section={section} /> : <div>Detail</div>}</PortalQueryClientScope>;
    const rendered = renderIntoDocument(view('quotes'));
    expect(frames).toHaveLength(0);
    rendered.rerender(view('quotes', false));
    client.setQueryData(['commercialListView', 'project-a', 'quotes-scroll'], 350);
    rendered.rerender(view('quotes'));
    act(() => frames.splice(0).forEach((frame) => frame(0)));
    expect(scroll).toHaveBeenCalledWith({ top: 350, behavior: 'instant' });
    scroll.mockClear();
    client.setQueryData(['commercialListView', 'project-a', 'invoices-scroll'], 900);
    rendered.rerender(view('invoices'));
    expect(frames).toHaveLength(0);
    expect(scroll).not.toHaveBeenCalled();
    rendered.unmount();
    request.mockRestore();
    scroll.mockRestore();
  });
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
