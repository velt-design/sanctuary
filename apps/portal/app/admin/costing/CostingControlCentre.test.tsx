import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CostingControlCentre from './CostingControlCentre';

const config = snapshotCostingControlConfigV1(loadCostingConfigV1());
const materialId = Object.keys(config.materialRatesExGst)[0]!;

function version(status: 'draft' | 'published', candidate = config) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    versionNumber: 1,
    status,
    schemaVersion: candidate.schemaVersion,
    baseManifestVersion: candidate.baseManifestVersion,
    basedOnVersionId: null,
    config: candidate,
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

function editorPayload(
  status: 'draft' | 'published',
  candidate = config,
  comparisonOverrides: Record<string, unknown> = {},
) {
  return {
    version: version(status, candidate),
    comparison: status === 'draft'
      ? {
          currentVersionId: null,
          currentSource: 'legacy-overrides',
          baselineConfig: config,
          diff: [],
          impact: [],
          ...comparisonOverrides,
        }
      : null,
    catalog: {
      materials: [{ id: materialId, label: 'Test material', unit: 'each', category: 'Test' }],
      actions: [],
    },
  };
}

function overview(status: 'draft' | 'published') {
  const item = version(status);
  return {
    currentVersionId: status === 'published' ? item.id : null,
    currentSource: status === 'published' ? 'published' as const : 'legacy-overrides' as const,
    versions: [item],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function buttonByText(root: ParentNode, text: string, occurrence = 0): HTMLButtonElement {
  const buttons = Array.from(root.querySelectorAll('button'))
    .filter((item) => item.textContent?.trim() === text);
  const button = buttons[occurrence];
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

function labelledInput(root: ParentNode, text: string): HTMLInputElement {
  const label = Array.from(root.querySelectorAll('label')).find((item) => item.textContent?.trim() === text);
  if (!(label instanceof HTMLLabelElement) || !label.htmlFor) throw new Error(`Label not found: ${text}`);
  const input = root.querySelector(`#${label.htmlFor}`);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Input not found: ${text}`);
  return input;
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('CostingControlCentre', () => {
  it('explains the safe first-use workflow without exposing technical IDs', () => {
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={{
      currentVersionId: null,
      currentSource: 'legacy-overrides',
      versions: [],
    }} />);

    expect(rendered.container.textContent).toContain('Legacy calculator settings');
    expect(rendered.container.textContent).toContain('Start with a safe draft');
    expect(rendered.container.textContent).toContain('Nothing changes for staff or customers');
    expect(buttonByText(rendered.container, 'Create first draft').disabled).toBe(false);
    rendered.unmount();
  });

  it('shows immutable publication context and keeps technical metadata collapsed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(editorPayload('published')), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    const rendered = renderIntoDocument(
      <CostingControlCentre initialOverview={overview('published')} />,
    );

    await click(buttonByText(rendered.container, 'View'));

    expect(rendered.container.textContent).toContain('Pricing version 1');
    expect(rendered.container.textContent).toContain('Why this version was published');
    expect(rendered.container.textContent).toContain('Published versions are immutable.');
    expect(buttonByText(rendered.container, 'Clone as new draft').disabled).toBe(false);
    const details = rendered.container.querySelector('details');
    expect(details?.open).toBe(false);
    await click(buttonByText(rendered.container, 'Materials'));
    const publishedRate = rendered.container.querySelector('input[aria-label="Test material version rate ex GST"]');
    expect(publishedRate).toBeInstanceOf(HTMLInputElement);
    expect((publishedRate as HTMLInputElement).disabled).toBe(true);
    rendered.unmount();
  });

  it('makes active and draft values clear and can reset an unsaved field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(editorPayload('draft')), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={overview('draft')} />);
    await click(buttonByText(rendered.container, 'Continue draft v1'));
    await click(buttonByText(rendered.container, 'Overheads'));

    const crewDayHours = labelledInput(rendered.container, 'Crew day length');
    const original = crewDayHours.value;
    await changeInput(crewDayHours, '9');

    expect(rendered.container.textContent).toContain('Unsaved changes');
    expect(rendered.container.textContent).toContain(`Active value: ${original} hours`);
    expect(buttonByText(rendered.container, 'Save & validate').disabled).toBe(false);

    await click(buttonByText(rendered.container, 'Reset to active'));
    expect(crewDayHours.value).toBe(original);
    rendered.unmount();
  });

  it('filters to changed values and protects unsaved work when returning to overview', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(editorPayload('draft')), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={overview('draft')} />);
    await click(buttonByText(rendered.container, 'Continue draft v1'));
    await click(buttonByText(rendered.container, 'Overheads'));
    await changeInput(labelledInput(rendered.container, 'Crew day length'), '9');

    const changedOnly = Array.from(rendered.container.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Show changed only'))
      ?.querySelector('input');
    if (!(changedOnly instanceof HTMLInputElement)) throw new Error('Changed-only control not found');
    await click(changedOnly as unknown as HTMLButtonElement);
    expect(rendered.container.textContent).toContain('Crew day length');
    expect(rendered.container.textContent).not.toContain('Operations setup per job');

    const overviewStep = rendered.container.querySelector('nav[aria-label="Costing workflow"] button');
    if (!(overviewStep instanceof HTMLButtonElement)) throw new Error('Overview workflow step not found');
    await click(overviewStep);
    expect(confirm).toHaveBeenCalledWith('Discard your unsaved costing changes?');
    expect(rendered.container.textContent).toContain('Draft version 1');
    rendered.unmount();
  });

  it('places server validation beside the affected business field', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify({
          error: 'Validation failed',
          issues: [{
            path: 'overheads.crewDayHours',
            message: 'Must be a finite number between 1 and 24.',
          }],
        }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(editorPayload('draft')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetch);
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={overview('draft')} />);
    await click(buttonByText(rendered.container, 'Continue draft v1'));
    await click(buttonByText(rendered.container, 'Overheads'));
    const crewDayHours = labelledInput(rendered.container, 'Crew day length');
    await changeInput(crewDayHours, '25');
    await click(buttonByText(rendered.container, 'Save & validate'));

    expect(crewDayHours.getAttribute('aria-invalid')).toBe('true');
    expect(rendered.container.textContent).toContain('Crew day length: Must be a finite number between 1 and 24.');
    rendered.unmount();
  });

  it('presents friendly diffs, component impacts and a large-change warning', async () => {
    const candidate = structuredClone(config);
    candidate.materialRatesExGst[materialId] += 10;
    const payload = editorPayload('draft', candidate, {
      diff: [{
        path: `materialRatesExGst.${materialId}`,
        before: config.materialRatesExGst[materialId],
        after: candidate.materialRatesExGst[materialId],
      }],
      impact: [{
        id: 'scenario-1',
        label: 'Standard pergola',
        beforeTotalExGst: 1000,
        afterTotalExGst: 1120,
        deltaExGst: 120,
        deltaPercent: 12,
        beforeMaterialsExGst: 500,
        afterMaterialsExGst: 620,
        beforeInstallExGst: 300,
        afterInstallExGst: 300,
        beforeOverheadExGst: 200,
        afterOverheadExGst: 200,
      }],
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={overview('draft')} />);
    await click(buttonByText(rendered.container, 'Continue draft v1'));
    await click(buttonByText(rendered.container, 'Review impact'));

    expect(rendered.container.textContent).toContain('Test material — material rate');
    expect(rendered.container.textContent).toContain('Large pricing movement detected.');
    expect(rendered.container.textContent).toContain('Materials');
    expect(rendered.container.textContent).toContain('Labour');
    expect(rendered.container.textContent).toContain('Overheads');
    expect(buttonByText(rendered.container, 'Continue to publish').disabled).toBe(false);
    rendered.unmount();
  });
});
