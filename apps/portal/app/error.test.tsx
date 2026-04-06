import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { renderIntoDocument } from '../../../test/reactHarness';
import GlobalError from './error';

vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/projects',
}));

describe('GlobalError diagnostics logging', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('logs a structured portal error payload', async () => {
    const error = Object.assign(new Error('Portal blew up'), { digest: 'digest-123' });
    const rendered = renderIntoDocument(<GlobalError error={error} reset={() => undefined} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[portal]',
      expect.objectContaining({
        event: 'portal.global_error',
        message: 'Portal blew up',
        digest: 'digest-123',
        pathname: '/staff/projects',
      }),
    );

    rendered.unmount();
  });
});
