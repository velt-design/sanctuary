import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import DesignWorkbenchFixtureClient from './DesignWorkbenchFixtureClient';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { installDomGeometryMock, renderIntoDocument } from '../../../../../../../test/reactHarness';

function clickButtonByText(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(label));
  if (!button) throw new Error(`Missing button: ${label}`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('DesignWorkbenchFixtureClient', () => {
  let restoreGeometry: (() => void) | null = null;

  beforeEach(() => {
    restoreGeometry = installDomGeometryMock();
  });

  afterEach(() => {
    restoreGeometry?.();
    restoreGeometry = null;
    document.body.innerHTML = '';
  });

  it('renders the read-only workbench shell from fixture data and supports local view toggles', async () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected mono fixture');

    const rendered = renderIntoDocument(
      <DesignWorkbenchFixtureClient fixture={fixture} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    expect(rendered.container.textContent).toContain('Drawing Workbench');
    expect(rendered.container.textContent).toContain('Sheet View');
    expect(rendered.container.textContent).toContain('Model Space');
    expect(rendered.container.textContent).not.toContain('Rotate +90');

    clickButtonByText(rendered.container, 'Model Space');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[aria-label="Plan model space viewport"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Reset view');
    expect(rendered.container.textContent).not.toContain('Rotate +90');

    clickButtonByText(rendered.container, 'Section');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Section model space is staged for a later milestone.');

    rendered.unmount();
  });
});
