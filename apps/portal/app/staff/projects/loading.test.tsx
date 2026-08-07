import { describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectsLoading from './loading';

describe('ProjectsLoading', () => {
  it('shows a non-blocking project-list route shell while server data streams', () => {
    const rendered = renderIntoDocument(<ProjectsLoading />);

    expect(rendered.container.querySelector('[aria-label="Page loading"]')).toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell="projects"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-projects-index-state="pending"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Filters"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Projects list"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-structure="projects-table"]')).not.toBeNull();
    expect((rendered.container.querySelector('#projectSearch') as HTMLInputElement).disabled).toBe(true);
    expect(Array.from(rendered.container.querySelectorAll<HTMLSelectElement>('[role="search"] select')).every((select) => select.disabled)).toBe(true);
    expect(rendered.container.textContent).toContain('Next attention');
    expect(rendered.container.textContent).toContain('Updating projects');

    rendered.unmount();
  });
});
