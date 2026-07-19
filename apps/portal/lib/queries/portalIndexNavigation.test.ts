import { describe, expect, it, vi } from 'vitest';
import { openPortalIndexInstantly, portalIndexOpeningHref, portalIndexTarget } from './portalIndexNavigation';

describe('portal index instant navigation', () => {
  it('recognizes only canonical Projects and Contacts indexes', () => {
    expect(portalIndexTarget('/staff/projects?archive=all', 'https://portal.test')?.route).toBe('projects-index');
    expect(portalIndexTarget('/staff/contacts', 'https://portal.test')?.route).toBe('contacts-index');
    expect(portalIndexTarget('/staff/contacts/ct_1', 'https://portal.test')).toBeNull();
    expect(portalIndexTarget('https://other.test/staff/contacts', 'https://portal.test')).toBeNull();
    expect(portalIndexOpeningHref('/staff/contacts', 'https://portal.test')).toBe('/staff/contacts?__portal_opening=contacts-index');
  });

  it('opens Contacts immediately and preserves modified clicks', () => {
    window.history.replaceState(null, '', '/dashboard');
    const replace = vi.fn();
    const preventDefault = vi.fn();
    const baseEvent = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      preventDefault,
    };
    expect(openPortalIndexInstantly(baseEvent, { replace }, '/staff/contacts')).toBe('contacts-index');
    expect(window.location.pathname).toBe('/staff/contacts');
    expect(window.location.search).toContain('__portal_opening=contacts-index');
    expect(replace).toHaveBeenCalledWith('/staff/contacts', { scroll: false });

    replace.mockReset();
    preventDefault.mockReset();
    expect(openPortalIndexInstantly({ ...baseEvent, ctrlKey: true }, { replace }, '/staff/contacts')).toBeNull();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
