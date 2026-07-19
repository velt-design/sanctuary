import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectDetailLoading from './loading';

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

it('renders a non-blocking project route shell while the route payload arrives', () => {
  const html = renderToStaticMarkup(<ProjectDetailLoading />);

  expect(html).toContain('data-project-route-pending="true"');
  expect(html).toContain('Opening project...');
  expect(html).not.toContain('aria-label="Page loading"');
});
