import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalFirstPortalMutations from './LocalFirstPortalMutations';
import { renderIntoDocument } from '../../../../test/reactHarness';

const registerLocalFirstMutationHandlerMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/lib/localFirst/queue', () => ({
  enqueueAndProcessLocalFirstMutation: vi.fn(),
  registerLocalFirstMutationHandler: (...args: unknown[]) => registerLocalFirstMutationHandlerMock(...args),
}));

vi.mock('@/lib/repo/apiClient', () => ({
  apiJson: vi.fn(),
  ApiError: class ApiError extends Error {
    status = 500;
    body = null;
  },
}));

vi.mock('@/lib/queries/projectCache', () => ({
  invalidateProjectReadCaches: vi.fn(),
}));

vi.mock('@/lib/localFirst/store', () => ({
  registerLocalFirstIdAlias: vi.fn(),
  resolveLocalFirstId: (value: string) => value,
}));

describe('LocalFirstPortalMutations', () => {
  beforeEach(() => {
    registerLocalFirstMutationHandlerMock.mockReset();
    registerLocalFirstMutationHandlerMock.mockImplementation(() => () => undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('registers only the heavy-editor local-first handlers', () => {
    const rendered = renderIntoDocument(<LocalFirstPortalMutations />);

    const registeredKeys = registerLocalFirstMutationHandlerMock.mock.calls.map(([key]) => key);

    expect(registeredKeys).toEqual(
      expect.arrayContaining([
        'portal.estimate.create',
        'portal.estimate.update',
        'portal.designRequest.create',
        'portal.quote.createFromEstimate',
        'portal.quote.updateDraft',
        'portal.estimate.notes.update',
      ]),
    );
    expect(registeredKeys).not.toContain('portal.project.details.update');
    expect(registeredKeys).not.toContain('portal.project.tasks.toggle');
    expect(registeredKeys).not.toContain('portal.contact.update');

    rendered.unmount();
  });
});
