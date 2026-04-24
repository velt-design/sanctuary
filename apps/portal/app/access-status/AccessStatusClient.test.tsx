import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccessStatusClient from './AccessStatusClient';
import { renderIntoDocument } from '../../../../test/reactHarness';

const replaceMock = vi.fn();
const signOutMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({
    signOut: (...args: unknown[]) => signOutMock(...args),
  }),
}));

describe('AccessStatusClient', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the no-access state and signs out to login', async () => {
    const rendered = renderIntoDocument(
      <AccessStatusClient state="no-access" callbackUrl="/staff/projects" />,
    );

    expect(rendered.container.textContent).toContain('Access not assigned');

    const button = rendered.container.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(signOutMock).toHaveBeenCalledWith('/login');

    rendered.unmount();
  });

  it('renders the lookup-failed state and retries the requested route', async () => {
    const rendered = renderIntoDocument(
      <AccessStatusClient state="lookup-failed" callbackUrl="/staff/projects?q=deck" />,
    );

    expect(rendered.container.textContent).toContain('Access check unavailable');

    const buttons = rendered.container.querySelectorAll('button');
    await act(async () => {
      (buttons[0] as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(replaceMock).toHaveBeenCalledWith('/staff/projects?q=deck');

    await act(async () => {
      (buttons[1] as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(signOutMock).toHaveBeenCalledWith('/login');

    rendered.unmount();
  });
});
