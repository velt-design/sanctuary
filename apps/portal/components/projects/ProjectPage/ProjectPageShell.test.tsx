import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectPageShell from './ProjectPageShell';

vi.mock('./ProjectMainTabs', () => ({
  default: ({ tab }: { tab: string }) => <div data-testid="project-main-tabs" data-tab={tab} />,
}));

const snapshot = {
  project: { id: 'proj_123', name: 'Test project', stage: 'lead' },
  pipeline: { stage: 'lead' },
  activity: [],
  emails: [],
  notes: [],
} as any;

describe('ProjectPageShell', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders one full-width tab surface without rails, drop zones, or resize handles', () => {
    const rendered = renderIntoDocument(<ProjectPageShell host="host" snapshot={snapshot} tab="quotes" />);

    expect(rendered.container.querySelector('[data-project-page-shell="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="project-main-tabs"]')?.getAttribute('data-tab')).toBe('quotes');
    expect(rendered.container.querySelector('[data-project-rail]')).toBeNull();
    expect(rendered.container.querySelector('[data-project-drop-zone]')).toBeNull();
    expect(rendered.container.querySelector('[role="separator"]')).toBeNull();

    rendered.unmount();
  });
});
