import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ListCountBanner from './ListCountBanner';

vi.mock('./ListCountBanner.module.css', () => ({ default: { banner: 'banner', icon: 'icon' } }));

describe('ListCountBanner', () => {
  it('keeps the completeness warning actionable without inserting its full banner above list controls', () => {
    const view = renderIntoDocument(<ListCountBanner compact truncated totalCount={5000} visibleCount={4000} entityLabelSingular="project" entityLabelPlural="projects" />);
    const trigger = view.container.querySelector('button')!;
    expect(trigger.textContent).toBe('List limited');
    expect(view.container.textContent).not.toContain('Showing first');
    act(() => trigger.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Showing first 4,000 of 5,000 projects');
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    view.unmount();
  });
  it('renders nothing when both visibleCount and totalCount are below the threshold', () => {
    const markup = renderToStaticMarkup(
      <ListCountBanner
        totalCount={50}
        visibleCount={50}
        entityLabelSingular="contact"
        entityLabelPlural="contacts"
      />,
    );
    expect(markup).toBe('');
  });

  it('renders the count-aware copy when totalCount crosses the threshold', () => {
    const markup = renderToStaticMarkup(
      <ListCountBanner
        totalCount={4500}
        visibleCount={4000}
        entityLabelSingular="contact"
        entityLabelPlural="contacts"
      />,
    );
    expect(markup).toContain('Showing 4,000 of 4,500 contacts');
    expect(markup).toContain('Heads up');
  });

  it('falls back to count-less copy when totalCount is null (count was not requested)', () => {
    const markup = renderToStaticMarkup(
      <ListCountBanner
        totalCount={null}
        visibleCount={4200}
        entityLabelSingular="project"
        entityLabelPlural="projects"
      />,
    );
    expect(markup).toContain('Showing 4,200 projects');
    expect(markup).not.toContain('of');
  });

  it('uses the singular label when exactly one row is visible', () => {
    const markup = renderToStaticMarkup(
      <ListCountBanner
        totalCount={4500}
        visibleCount={1}
        entityLabelSingular="contact"
        entityLabelPlural="contacts"
      />,
    );
    expect(markup).toContain('Showing 1 of 4,500 contact');
  });

  it('renders the polite live-region attributes for screen readers', () => {
    const markup = renderToStaticMarkup(
      <ListCountBanner
        totalCount={5000}
        visibleCount={4000}
        entityLabelSingular="project"
        entityLabelPlural="projects"
      />,
    );
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });
});
