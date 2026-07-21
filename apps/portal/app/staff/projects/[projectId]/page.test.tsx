import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectDetailPage from './page';

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('./ProjectSnapshotPageClient', () => ({
  default: (props: { projectId: string; tab: string; estimateId: string | null; debugExportEnabled: boolean }) => (
    <div
      data-testid="project-page"
      data-project-id={props.projectId}
      data-tab={props.tab}
      data-estimate-id={props.estimateId ?? ''}
      data-debug-enabled={String(props.debugExportEnabled)}
    />
  ),
}));

describe('ProjectDetailPage', () => {
  it('renders an unavailable state for invalid ids', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: '   ' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('Invalid project id.');
  });

  it('passes route state to the client without blocking on the project snapshot', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'quotes', estimateId: 'est_1' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-project-id="proj_1"');
    expect(markup).toContain('data-tab="quotes"');
    expect(markup).toContain('data-estimate-id="est_1"');
  });

  it('coerces removed files tabs back to activity', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'files' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-project-id="proj_1"');
    expect(markup).toContain('data-tab="activity"');
  });

  it('coerces the retired Emails tab back to activity', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'emails' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-tab="activity"');
  });

  it('accepts invoices through the shared project-tab contract', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'invoices' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-tab="invoices"');
  });
});
