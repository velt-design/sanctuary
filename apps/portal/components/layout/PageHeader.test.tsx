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
});
