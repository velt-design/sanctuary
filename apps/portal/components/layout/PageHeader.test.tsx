import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PageHeader from './PageHeader';
import { renderIntoDocument } from '../../../../test/reactHarness';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('PageHeader', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the canonical header slots together', () => {
    const rendered = renderIntoDocument(
      <PageHeader
        title="Projects"
        subtitle="Operational view"
        meta="42 active"
        back={{ label: 'Back to dashboard', href: '/dashboard' }}
        primaryAction={{ label: 'New project', href: '/staff/projects/new' }}
        secondaryActions={[{ label: 'Archive' }]}
        right={<span>Right slot</span>}
      />,
    );

    expect(rendered.container.querySelector('h1')?.textContent).toBe('Projects');
    expect(rendered.container.textContent).toContain('Operational view');
    expect(rendered.container.textContent).toContain('42 active');
    expect(rendered.container.textContent).toContain('Back to dashboard');
    expect(rendered.container.textContent).toContain('New project');
    expect(rendered.container.textContent).toContain('More');
    expect(rendered.container.textContent).toContain('Right slot');

    rendered.unmount();
  });

  it('uses button actions when the primary action is callback-driven', () => {
    const onClick = vi.fn();
    const rendered = renderIntoDocument(
      <PageHeader
        title="Contacts"
        primaryAction={{ label: 'Save', onClick }}
      />,
    );

    const button = Array.from(rendered.container.querySelectorAll('button')).find((node) => node.textContent === 'Save') as HTMLButtonElement;

    act(() => {
      button.click();
    });

    expect(onClick).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it('renders the approved dashboard, index, and detail variants explicitly', () => {
    const rendered = renderIntoDocument(
      <div>
        <PageHeader variant="dashboard" title="Dashboard" eyebrow="Friday 24 May 2024" />
        <PageHeader variant="index" title="Active projects" count="142 projects" description="Overview of all projects." />
        <PageHeader
          variant="detail"
          title="Remuera Residence"
          breadcrumbs={[{ label: 'Projects', href: '/staff/projects' }, { label: 'P-2307' }]}
        />
      </div>,
    );

    expect(rendered.container.querySelector('[data-page-header-variant="dashboard"] h1')?.textContent).toBe('Dashboard');
    expect(rendered.container.querySelector('[data-page-header-variant="index"]')?.textContent).toContain('142 projects');
    expect(rendered.container.querySelector('[data-page-header-variant="detail"] nav')?.textContent).toContain('Projects');

    rendered.unmount();
  });

  it('decouples semantic heading level from the visual variant', () => {
    const rendered = renderIntoDocument(<PageHeader variant="detail" headingLevel={3} title="Remuera Residence" />);
    expect(rendered.container.querySelector('h3')?.textContent).toBe('Remuera Residence');
    expect(rendered.container.querySelector('h1')).toBeNull();
    rendered.unmount();
  });

  it('adds the opt-in utility rail without changing the existing action contract', () => {
    const rendered = renderIntoDocument(
      <PageHeader
        variant="index"
        title="Projects"
        utility={<label>Portal search<input /></label>}
        primaryAction={{ label: 'New project', href: '/staff/projects/new' }}
      />,
    );
    expect(rendered.container.textContent).toContain('Portal search');
    expect(rendered.container.textContent).toContain('New project');
    rendered.unmount();
  });
});
