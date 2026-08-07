import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ImportsClient from './ImportsClient';

vi.mock('@/components/layout/StaffPageHeader', () => ({
  default: ({ title, right }: { title: string; right?: ReactNode }) => (
    <header><h1>{title}</h1>{right}</header>
  ),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

describe('ImportsClient stable frame', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the final import summary structure before a file is selected', () => {
    const rendered = renderIntoDocument(<ImportsClient />);

    expect(rendered.container.querySelector('[data-portal-page-shell="admin-imports"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-shell-region="admin-imports-summary"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Select JSON files');
    expect(rendered.container.textContent).toContain('Schedule items');
    expect(rendered.container.textContent).toContain('Select one or more JSON files to preview and import.');

    rendered.unmount();
  });
});
