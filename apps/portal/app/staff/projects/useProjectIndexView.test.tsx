import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { useProjectIndexView } from './useProjectIndexView';
import { parseProjectIndexView, projectIndexViewHref } from './projectIndexView';
import { readProjectIndexPosition, rememberProjectIndexPosition, resolveProjectIndexReturnHref, setProjectIndexSession } from '@/lib/projects/projectIndexSession';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));

let state: ReturnType<typeof useProjectIndexView>;
function Harness() { state = useProjectIndexView(); return <span>{JSON.stringify(state.view)}</span>; }

beforeEach(() => {
  window.sessionStorage.clear();
  setProjectIndexSession('alice', 'environment-a');
  window.history.replaceState(null, '', '/staff/projects');
});

describe('project index leave and return', () => {
  it('restores the same visible project after row heights change', () => {
    const row = document.createElement('div');
    row.dataset.projectIndexAnchor = 'proj_anchor';
    document.body.append(row);
    const rect = vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 20, bottom: 80 } as DOMRect);
    rememberProjectIndexPosition('/staff/projects', 300);
    rect.mockReturnValue({ top: 520, bottom: 580 } as DOMRect);
    const rendered = renderIntoDocument(<Harness />);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    act(() => state.restoreScroll(true));
    expect(scroll).toHaveBeenCalledWith({ top: 500, behavior: 'instant' });
    expect(readProjectIndexPosition()?.scrollY).toBe(500);
    scroll.mockRestore(); rect.mockRestore(); row.remove(); rendered.unmount();
  });
  it('persists the exact working view across a project return and remount', () => {
    let rendered = renderIntoDocument(<Harness />);
    act(() => state.update({ query: 'deck', stageFilter: 'SENT', sort: 'name_desc', pageSize: 25 }));
    act(() => state.update({ page: 3 }, false));
    const href = window.location.pathname + window.location.search;
    rememberProjectIndexPosition(href, 750);
    rendered.unmount();
    window.history.pushState(null, '', '/staff/projects/proj_one');
    expect(resolveProjectIndexReturnHref('/staff/projects')).toBe(href);
    window.history.pushState(null, '', resolveProjectIndexReturnHref('/staff/projects'));
    rendered = renderIntoDocument(<Harness />);
    expect(state.view).toMatchObject({ query: 'deck', stageFilter: 'SENT', sort: 'name_desc', page: 3, pageSize: 25 });
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    act(() => state.restoreScroll(false));
    expect(scroll).not.toHaveBeenCalled();
    act(() => state.restoreScroll(true));
    expect(scroll).toHaveBeenCalledWith({ top: 750, behavior: 'instant' });
    scroll.mockRestore();
    rendered.unmount();
  });

  it('follows external history, preserves live typing, and resets all controls', () => {
    const rendered = renderIntoDocument(<Harness />);
    act(() => state.update({ query: 'deck ' }));
    rendered.rerender(<Harness />);
    expect(state.view.query).toBe('deck ');
    const previous = projectIndexViewHref({ ...state.view, query: 'roof', page: 4, sort: 'oldest' });
    act(() => { window.history.replaceState(null, '', previous); rendered.rerender(<Harness />); });
    expect(state.view).toMatchObject({ query: 'roof', page: 4, sort: 'oldest' });
    act(() => state.update({ ownerFilter: 'unassigned' }));
    expect(state.view.page).toBe(1);
    act(() => state.reset());
    expect(state.view).toEqual(parseProjectIndexView(new URLSearchParams()));
    rendered.unmount();
  });

  it('does not share restoration across accounts or environments or override explicit links', () => {
    rememberProjectIndexPosition('/staff/projects?q=private&page=2', 200);
    expect(resolveProjectIndexReturnHref('/staff/projects?stage=NEW')).toBe('/staff/projects?stage=NEW');
    setProjectIndexSession('bob', 'environment-a');
    expect(readProjectIndexPosition()).toBeNull();
    setProjectIndexSession('alice', 'environment-b');
    expect(readProjectIndexPosition()).toBeNull();
    setProjectIndexSession(null, '');
    expect(resolveProjectIndexReturnHref('/staff/projects')).toBe('/staff/projects');
  });

  it('validates stored destinations and malformed pagination', () => {
    rememberProjectIndexPosition('https://other.test/staff/projects?q=secret', 1);
    expect(readProjectIndexPosition()).toBeNull();
    expect(parseProjectIndexView(new URLSearchParams('page=-2&pageSize=999&sort=invalid'))).toMatchObject({ page: 1, pageSize: 50, sort: 'newest' });
    expect(parseProjectIndexView(new URLSearchParams('page=1.5'))).toMatchObject({ page: 1 });
  });
});
