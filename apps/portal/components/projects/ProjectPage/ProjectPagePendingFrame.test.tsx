import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectPagePendingFrame from './ProjectPagePendingFrame';

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

describe('ProjectPagePendingFrame', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the final project header, navigation, and Overview regions mounted', () => {
    const rendered = renderIntoDocument(<ProjectPagePendingFrame projectId="proj_1" activeTab="activity" />);

    expect(rendered.container.querySelector('[data-portal-page-shell="project-detail"]')?.getAttribute('data-portal-page-shell-ready')).toBe('true');
    expect(rendered.container.querySelector('[data-project-page-frame="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Project sections"]')).not.toBeNull();
    expect(Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('[aria-label="Project sections"] [role="tab"]')).every((tab) => tab.disabled)).toBe(true);
    expect(rendered.container.querySelector('[data-project-overview-layout="true"]')).not.toBeNull();
    for (const region of ['orientation', 'project-work', 'commercial', 'recent']) {
      expect(rendered.container.querySelector(`[data-project-overview-region="${region}"]`)).not.toBeNull();
    }
    expect(rendered.container.querySelectorAll('[data-portal-value-slot="loading"]').length).toBeGreaterThan(10);
    expect(rendered.container.querySelector('main[aria-busy="true"]')).toBeNull();
    rendered.unmount();
  });

  it('renders the exact Calculator workspace frame instead of a tab-level loader', () => {
    const rendered = renderIntoDocument(<ProjectPagePendingFrame projectId="proj_1" activeTab="estimates" />);

    const calculator = rendered.container.querySelector('[data-calculator-workspace="project"]');
    expect(calculator?.querySelector('[data-calculator-command-bar]')).not.toBeNull();
    expect(calculator?.querySelector('[data-calculator-configuration-form]')).not.toBeNull();
    expect(calculator?.querySelector('[data-calculator-result-inspector]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-tab-loading]')).toBeNull();
    rendered.unmount();
  });

  it('keeps Invoices nested inside the Commercial frame', () => {
    const rendered = renderIntoDocument(<ProjectPagePendingFrame projectId="proj_1" activeTab="invoices" />);

    const projectNavigation = rendered.container.querySelector('[aria-label="Project sections"]');
    const commercialNavigation = rendered.container.querySelector('[aria-label="Commercial sections"]');
    expect(projectNavigation?.textContent).toContain('Commercial');
    expect(projectNavigation?.textContent).not.toContain('Invoices');
    expect(commercialNavigation?.textContent).toContain('Invoices');
    expect(rendered.container.querySelector('table[aria-label="Invoices"]')).not.toBeNull();
    rendered.unmount();
  });

  it('shows the canonical Job Packs table only for its requested compatibility route', () => {
    const rendered = renderIntoDocument(<ProjectPagePendingFrame activeTab="job-packs" />);

    expect(rendered.container.querySelector('[data-portal-page-shell="project-job-packs"]')).not.toBeNull();
    expect(rendered.container.querySelector('table[aria-label="Job packs"]')).not.toBeNull();
    rendered.unmount();
  });
});
