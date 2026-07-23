import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CostingControlCentre from './CostingControlCentre';

const config = snapshotCostingControlConfigV1(loadCostingConfigV1());

function version(status: 'draft' | 'published') {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    versionNumber: 1,
    status,
    schemaVersion: config.schemaVersion,
    baseManifestVersion: config.baseManifestVersion,
    basedOnVersionId: null,
    config,
    contentHash: 'a'.repeat(64),
    createdAt: '2026-07-23T00:00:00.000Z',
    createdByEmail: 'admin@example.com',
    updatedAt: '2026-07-23T01:00:00.000Z',
    updatedByEmail: 'admin@example.com',
    publishedAt: status === 'published' ? '2026-07-23T01:00:00.000Z' : null,
    publishedByEmail: status === 'published' ? 'admin@example.com' : null,
    publishNote: status === 'published' ? 'Reviewed representative jobs.' : null,
    publicationDiff: status === 'published' ? [] : null,
    publicationImpact: status === 'published' ? [] : null,
  };
}

function editorPayload(status: 'draft' | 'published') {
  return {
    version: version(status),
    comparison: status === 'draft'
      ? {
          currentVersionId: null,
          currentSource: 'legacy-overrides',
          diff: [],
          impact: [],
        }
      : null,
    catalog: {
      materials: [{ id: Object.keys(config.materialRatesExGst)[0]!, label: 'Test material', unit: 'each', category: 'Test' }],
      actions: [],
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find((item) => item.textContent?.trim() === text);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

function labelInput(root: ParentNode, text: string): HTMLInputElement {
  const label = Array.from(root.querySelectorAll('label')).find((item) => item.textContent?.trim() === text);
  const input = label?.querySelector('input');
  if (!(input instanceof HTMLInputElement)) throw new Error(`Input not found: ${text}`);
  return input;
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

describe('CostingControlCentre', () => {
  it('shows immutable publication metadata and package-owned comparison sections', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(editorPayload('published')), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    const published = version('published');
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={{
      currentVersionId: published.id,
      currentSource: 'published',
      versions: [published],
    }} />);

    await click(buttonByText(rendered.container, 'Open'));

    expect(rendered.container.textContent).toContain('Version 1');
    expect(rendered.container.textContent).toContain('Publication note:');
    expect(rendered.container.textContent).toContain('Published versions are read-only.');
    expect(buttonByText(rendered.container, 'Clone as new draft').disabled).toBe(false);
    rendered.unmount();
  });

  it('keeps edits local until the admin explicitly saves and previews', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(editorPayload('draft')), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    const draft = version('draft');
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={{
      currentVersionId: null,
      currentSource: 'legacy-overrides',
      versions: [draft],
    }} />);
    await click(buttonByText(rendered.container, 'Open'));
    await click(buttonByText(rendered.container, 'Overheads'));
    const crewDayHours = labelInput(rendered.container, 'Crew day hours');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(crewDayHours, '9');
      crewDayHours.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(rendered.container.textContent).toContain('Unsaved changes');
    expect(buttonByText(rendered.container, 'Save and preview').disabled).toBe(false);
    expect(buttonByText(rendered.container, 'Publish version').disabled).toBe(true);
    rendered.unmount();
  });
});
