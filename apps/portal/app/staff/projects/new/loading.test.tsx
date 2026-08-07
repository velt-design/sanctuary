import { describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import Loading from './loading';

describe('new project loading frame', () => {
  it('keeps the complete project form structure mounted', () => {
    const rendered = renderIntoDocument(<Loading />);
    const root = rendered.container.querySelector('[data-portal-page-shell="project-create"]');

    expect(root?.getAttribute('data-portal-page-shell-ready')).toBe('true');
    expect(root?.querySelector('[aria-label="Project form"]')).not.toBeNull();
    expect(root?.querySelector('[aria-label="Primary contact choice"]')).not.toBeNull();
    expect(root?.querySelector('button')).not.toBeNull();
    rendered.unmount();
  });
});
