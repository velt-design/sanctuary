import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import AccessClient from './AccessClient';

vi.mock('@/components/layout/StaffPageHeader', () => ({
  default: ({ title }: { title: string }) => <header><h1>{title}</h1></header>,
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

describe('AccessClient stable frame', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('keeps the account form and crew table header visible during the crew request', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));

    const rendered = renderIntoDocument(<AccessClient />);

    expect(rendered.container.querySelector('[data-portal-page-shell="admin-access"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-admin-access-background-ready="false"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Set temp password');
    expect(rendered.container.textContent).toContain('Schedule crews');
    expect(rendered.container.textContent).toContain('Board jobs');
    expect(rendered.container.querySelector('[data-portal-value-slot="loading"]')).not.toBeNull();

    rendered.unmount();
  });
});
