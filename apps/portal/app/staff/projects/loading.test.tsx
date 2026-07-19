import { describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectsLoading from './loading';

describe('ProjectsLoading', () => {
  it('shows a non-blocking project-list route shell while server data streams', () => {
    const rendered = renderIntoDocument(<ProjectsLoading />);

    expect(rendered.container.querySelector('[aria-label="Opening projects"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Page loading"]')).toBeNull();
    expect(rendered.container.querySelector('[data-projects-index-state="pending"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Filters"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Projects list"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Updating projects');

    rendered.unmount();
  });
});
