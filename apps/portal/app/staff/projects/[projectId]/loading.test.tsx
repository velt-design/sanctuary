import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import ProjectDetailLoading from './loading';

let projectId: string | string[] = 'proj_123';
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId }),
  useSearchParams: () => searchParams,
}));

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

describe('Project detail loading frame', () => {
  beforeEach(() => {
    projectId = 'proj_123';
    searchParams = new URLSearchParams();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['activity', '[data-project-overview-layout="true"]'],
    ['estimates', '[data-calculator-workspace="project"]'],
    ['quotes', '[data-project-commercial-view="quotes"]'],
    ['invoices', '[data-portal-page-shell="invoice-list"]'],
    ['job-packs', '[data-portal-page-shell="project-job-packs"]'],
  ])('keeps the exact %s tab structure continuous', (tab, expectedSelector) => {
    searchParams = new URLSearchParams(`tab=${tab}`);

    const rendered = renderIntoDocument(<ProjectDetailLoading />);

    expect(rendered.container.querySelector('[data-project-active-tab]')?.getAttribute('data-project-active-tab')).toBe(tab);
    expect(rendered.container.querySelector(expectedSelector)).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-instant-shell]')).toBeNull();
    rendered.unmount();
  });

  it('carries the decoded project id into safe links while every loading control stays disabled', () => {
    projectId = 'proj_hello%20world';
    searchParams = new URLSearchParams('tab=invoices');

    const rendered = renderIntoDocument(<ProjectDetailLoading />);
    const root = rendered.container.querySelector('[data-portal-page-shell="project-detail"]');
    const projectTabs = root?.querySelectorAll<HTMLButtonElement>('[aria-label="Project sections"] [role="tab"]') ?? [];
    const commercialTabs = root?.querySelectorAll<HTMLButtonElement>('[aria-label="Commercial sections"] [role="tab"]') ?? [];

    expect(root?.getAttribute('data-project-id')).toBe('proj_hello world');
    expect(root?.querySelector<HTMLAnchorElement>('a[href="/staff/projects/proj_hello%20world/design-workbench"]')).not.toBeNull();
    expect(Array.from(projectTabs).every((tab) => tab.disabled)).toBe(true);
    expect(Array.from(commercialTabs).every((tab) => tab.disabled)).toBe(true);
    rendered.unmount();
  });

  it('falls back to the Overview frame for an invalid tab without enabling navigation', () => {
    searchParams = new URLSearchParams('tab=unknown');

    const rendered = renderIntoDocument(<ProjectDetailLoading />);

    expect(rendered.container.querySelector('[data-project-active-tab="activity"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-overview-layout="true"]')).not.toBeNull();
    rendered.unmount();
  });

  it('renders the deep quote editor and preview structures from the canonical query', () => {
    searchParams = new URLSearchParams('tab=quotes&quoteId=quote_1');

    const rendered = renderIntoDocument(<ProjectDetailLoading />);
    expect(rendered.container.querySelector('[data-portal-page-shell="quote-detail"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-quote-id="quote_1"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-page-shell="quote-list"]')).toBeNull();

    searchParams = new URLSearchParams('tab=quotes&quoteId=quote_1&quotePreview=1');
    rendered.rerender(<ProjectDetailLoading />);
    expect(rendered.container.querySelector('[data-portal-page-shell="quote-preview"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-quote-view-mode="preview"]')).not.toBeNull();
    rendered.unmount();
  });

  it('renders the selected job-pack sheet when an estimate is requested', () => {
    searchParams = new URLSearchParams(
      'tab=job-packs&estimateId=estimate_1&sheet=powdercoating-order',
    );

    const rendered = renderIntoDocument(<ProjectDetailLoading />);
    const sheet = rendered.container.querySelector<HTMLSelectElement>('[aria-label="Job pack sheet"]');
    expect(rendered.container.querySelector('[data-portal-page-shell="project-job-pack-detail"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-estimate-id="estimate_1"]')).not.toBeNull();
    expect(sheet?.value).toBe('powdercoating-order');
    expect(rendered.container.querySelector('table[aria-label="Job packs"]')).toBeNull();
    rendered.unmount();
  });
});
