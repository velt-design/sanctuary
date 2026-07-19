import { describe, expect, it, vi } from 'vitest';
import {
  openProjectsIndexInstantly,
  projectsIndexArchiveFromHref,
  projectsIndexOpeningHref,
  projectsIndexTarget,
} from './projectsIndexNavigation';

describe('projects index instant navigation', () => {
  it('recognizes only the canonical Projects index and preserves filters', () => {
    expect(projectsIndexTarget('/staff/projects?status=NEW', 'https://portal.test/dashboard')?.pathname).toBe('/staff/projects');
    expect(projectsIndexTarget('/staff/projects/proj_1', 'https://portal.test/dashboard')).toBeNull();
    expect(projectsIndexTarget('https://other.test/staff/projects', 'https://portal.test/dashboard')).toBeNull();
    expect(projectsIndexArchiveFromHref('/staff/projects?archive=archived', 'https://portal.test')).toBe('archived');
    expect(projectsIndexArchiveFromHref('/staff/projects?archive=invalid', 'https://portal.test')).toBe('active');
    expect(projectsIndexOpeningHref('/staff/projects?status=SENT', 'https://portal.test')).toBe(
      '/staff/projects?status=SENT&__portal_opening=projects-index',
    );
  });

  it('updates history immediately and replaces the transient URL in the background', () => {
    window.history.replaceState(null, '', '/dashboard');
    const preventDefault = vi.fn();
    const replace = vi.fn();
    const event = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      preventDefault,
    };

    expect(openProjectsIndexInstantly(event, { replace }, '/staff/projects?status=NEW')).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(window.location.pathname).toBe('/staff/projects');
    expect(window.location.search).toContain('__portal_opening=projects-index');
    expect(replace).toHaveBeenCalledWith('/staff/projects?status=NEW', { scroll: false });
  });

  it.each([
    { button: 1, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    { button: 0, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false },
    { button: 0, ctrlKey: false, metaKey: true, shiftKey: false, altKey: false },
  ])('preserves modified and non-primary clicks', (modifiers) => {
    const preventDefault = vi.fn();
    const replace = vi.fn();
    expect(openProjectsIndexInstantly({
      defaultPrevented: false,
      preventDefault,
      ...modifiers,
    }, { replace }, '/staff/projects')).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
