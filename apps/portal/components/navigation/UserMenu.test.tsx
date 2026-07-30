import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchKeyboard, renderIntoDocument } from '../../../../test/reactHarness';
import UserMenu from './UserMenu';

const session = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => session,
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

describe('UserMenu', () => {
  beforeEach(() => {
    session.signOut.mockReset();
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('opens the interactive theme controls as a labelled dialog', async () => {
    const rendered = renderIntoDocument(<UserMenu email="ops@example.com" roleLabel="Admin access" />);
    const trigger = rendered.container.querySelector('button') as HTMLButtonElement;

    act(() => trigger.click());

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLDivElement;
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('User settings');
    expect(dialog.textContent).toContain('ops@example.com');
    expect(dialog.querySelector('select')).not.toBeNull();
    expect(dialog.querySelector('input[type="color"]')).not.toBeNull();
    expect(dialog.querySelector('[role="menuitem"]')).toBeNull();

    dispatchKeyboard(document, 'Escape');
    await act(async () => Promise.resolve());
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    rendered.unmount();
  });

  it('closes before delegating sign-out to the session owner', async () => {
    const rendered = renderIntoDocument(<UserMenu email="ops@example.com" roleLabel="Admin access" />);
    const trigger = rendered.container.querySelector('button') as HTMLButtonElement;
    act(() => trigger.click());
    const signOut = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Sign out')) as HTMLButtonElement;

    await act(async () => {
      signOut.click();
      await Promise.resolve();
    });

    expect(session.signOut).toHaveBeenCalledWith('/login');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    rendered.unmount();
  });
});
