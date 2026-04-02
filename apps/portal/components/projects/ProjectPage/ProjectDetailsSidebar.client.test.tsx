import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectDetailsSidebarClient from './ProjectDetailsSidebar.client';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const apiJsonMock = vi.fn();
const invalidateProjectReadCachesMock = vi.fn();
const patchProjectDetailsCachesMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

vi.mock('@/lib/repo/apiClient', () => ({
  apiJson: (...args: unknown[]) => apiJsonMock(...args),
}));

vi.mock('@/lib/queries/projectCache', () => ({
  invalidateProjectReadCaches: (...args: unknown[]) => invalidateProjectReadCachesMock(...args),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/lib/localFirst/portalEntities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/localFirst/portalEntities')>();
  return {
    ...actual,
    patchProjectDetailsCaches: (...args: unknown[]) => patchProjectDetailsCachesMock(...args),
  };
});

const project = {
  id: 'proj_1',
  name: 'Original project',
  stage: 'new',
  contactId: 'ct_1',
  contactName: 'Taylor',
  contactEmail: 'taylor@example.com',
  contactPhone: '0210000000',
  siteAddress: '1 Example St',
  region: 'North',
  quoteRef: 'Q-1001',
  nextActionDate: '2026-04-03',
} as const;

function click(target: Element | null) {
  if (!target) throw new Error('Missing click target');
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function changeValue(target: HTMLInputElement | null, value: string) {
  if (!target) throw new Error('Missing input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing value setter');
  act(() => {
    setter.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ProjectDetailsSidebarClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiJsonMock.mockReset();
    invalidateProjectReadCachesMock.mockReset();
    patchProjectDetailsCachesMock.mockReset();
    apiJsonMock.mockResolvedValue({});
    invalidateProjectReadCachesMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('autosaves project details directly through the API', async () => {
    const rendered = renderIntoDocument(<ProjectDetailsSidebarClient project={project} />);

    click(rendered.container.querySelector('button'));
    changeValue(rendered.container.querySelector('#projectName'), 'Updated project');

    await act(async () => {
      vi.advanceTimersByTime(701);
      await Promise.resolve();
    });

    expect(apiJsonMock).toHaveBeenCalledWith(
      '/api/projects/proj_1/details',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"name":"Updated project"'),
      }),
    );
    expect(patchProjectDetailsCachesMock).toHaveBeenCalled();
    expect(invalidateProjectReadCachesMock).toHaveBeenCalledWith({}, 'host', 'proj_1');

    rendered.unmount();
  });
});
