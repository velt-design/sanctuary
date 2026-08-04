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
    name: status === 'draft' ? 'August supplier update' : 'July pricing',
    purpose: 'Keep supplier pricing current without changing formulas.',
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
      materials: [{
        id: materialId,
        label: 'Test material',
        unit: 'each',
        category: 'Test',
        supplier: null,
        product: null,
        note: null,
        assumption: false,
      }],
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

async function changeTextarea(input: HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(input, value);
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

  it('requires a durable name and purpose before creating a draft', async () => {
    const payload = editorPayload('draft');
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === '/api/admin/costing/configurations' && init?.method === 'POST') {
        return new Response(JSON.stringify({ version: payload.version }), { status: 201 });
      }
      if (String(url) === '/api/admin/costing/configurations') {
        return new Response(JSON.stringify(overview('draft')), { status: 200 });
      }
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={{
      currentVersionId: null,
      currentSource: 'legacy-overrides',
      versions: [],
    }} />);

    await click(buttonByText(rendered.container, 'Create first draft'));
    expect(rendered.container.getAttribute('role')).toBeNull();
    expect(rendered.container.textContent).toContain('Describe the pricing change');
    const name = rendered.container.querySelector('input[maxlength="80"]');
    const purpose = rendered.container.querySelector('textarea[maxlength="500"]');
    if (!(name instanceof HTMLInputElement) || !(purpose instanceof HTMLTextAreaElement)) {
      throw new Error('Draft metadata fields were not rendered');
    }
    await changeInput(name, 'August aluminium update');
    await changeTextarea(purpose, 'Refresh confirmed aluminium supplier costs for August.');
    await click(buttonByText(rendered.container, 'Create safe draft'));

    const createCall = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      sourceVersionId: null,
      name: 'August aluminium update',
      purpose: 'Refresh confirmed aluminium supplier costs for August.',
    });
    expect(rendered.container.textContent).toContain('Draft v1 created');
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

  it('searches the material catalog by business name without exposing internal IDs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(editorPayload('draft')), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={overview('draft')} />);
    await click(buttonByText(rendered.container, 'Continue draft v1'));
    const search = rendered.container.querySelector('input[placeholder="Search by name, category or internal ID"]');
    if (!(search instanceof HTMLInputElement)) throw new Error('Material search not found');

    await changeInput(search, 'missing supplier product');

    expect(rendered.container.textContent).toContain('0 shown · 0 changed');
    expect(rendered.container.textContent).toContain('No materials match “missing supplier product”');
    expect(rendered.container.textContent).not.toContain(materialId);
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

  it('lets Version 1 publish the current portal prices as an unchanged baseline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(editorPayload('draft')), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={overview('draft')} />);
    await click(buttonByText(rendered.container, 'Continue draft v1'));
    await click(buttonByText(rendered.container, 'Review impact'));

    expect(rendered.container.textContent).toContain('can publish it unchanged as the shared baseline');
    expect(rendered.container.textContent).toContain('No price movement');
    expect(buttonByText(rendered.container, 'Continue to publish').disabled).toBe(false);
    rendered.unmount();
  });

  it('saves, validates and refreshes the server-owned comparison', async () => {
    const savedCandidate = structuredClone(config);
    savedCandidate.overheads.crewDayHours = 9;
    const savedPayload = editorPayload('draft', savedCandidate, {
      diff: [{
        path: 'overheads.crewDayHours',
        before: config.overheads.crewDayHours,
        after: 9,
      }],
      impact: [],
    });
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify(savedPayload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url === '/api/admin/costing/configurations') {
        return new Response(JSON.stringify(overview('draft')), {
          status: 200,
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
    await changeInput(labelledInput(rendered.container, 'Crew day length'), '9');
    await click(buttonByText(rendered.container, 'Save & validate'));

    expect(rendered.container.textContent).toContain('The comparison and impact preview are up to date.');
    expect(buttonByText(rendered.container, 'Save & validate').disabled).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/costing/configurations/11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ method: 'PUT' }),
    );
    rendered.unmount();
  });

  it('requires a saved diff, audit note and explicit confirmation before publication', async () => {
    const candidate = structuredClone(config);
    candidate.materialRatesExGst[materialId] += 1;
    const payload = editorPayload('draft', candidate, {
      diff: [{
        path: `materialRatesExGst.${materialId}`,
        before: config.materialRatesExGst[materialId],
        after: candidate.materialRatesExGst[materialId],
      }],
      impact: [],
    });
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={overview('draft')} />);
    await click(buttonByText(rendered.container, 'Continue draft v1'));
    await click(buttonByText(rendered.container, 'Review impact'));
    await click(buttonByText(rendered.container, 'Continue to publish'));

    const publish = buttonByText(rendered.container, 'Publish pricing version');
    expect(publish.disabled).toBe(true);
    const note = rendered.container.querySelector('textarea[maxlength="1000"]');
    const confirmation = rendered.container.querySelector('label input[type="checkbox"]');
    if (!(note instanceof HTMLTextAreaElement)) throw new Error('Audit note not found');
    if (!(confirmation instanceof HTMLInputElement)) throw new Error('Confirmation not found');
    await changeTextarea(note, 'Reviewed supplier rate and representative project impact.');
    await act(async () => {
      confirmation.click();
    });

    expect(publish.disabled).toBe(false);
    expect(fetch.mock.calls.some(([url, init]) => (
      String(url).endsWith('/publish') && (init as RequestInit | undefined)?.method === 'POST'
    ))).toBe(false);
    rendered.unmount();
  });

  it('previews a recent saved estimate without replacing the fixed scenarios', async () => {
    const candidate = structuredClone(config);
    candidate.labour.crewHourRateExGst += 5;
    const payload = editorPayload('draft', candidate, {
      diff: [{ path: 'labour.crewHourRateExGst', before: 80, after: 85 }],
      impact: [],
    });
    const preview = {
      estimate: {
        id: 'estimate-1',
        projectId: 'project-1',
        projectName: 'Patricia Branch',
        quoteRef: 'Q-1042',
        siteAddress: 'Albany',
        version: 3,
        status: 'draft',
        updatedAt: '2026-07-20T00:00:00.000Z',
        savedCostingVersionId: null,
        savedProvenance: null,
      },
      impact: {
        id: 'estimate-1',
        label: 'Patricia Branch · estimate v3',
        beforeTotalExGst: 1000,
        afterTotalExGst: 1050,
        deltaExGst: 50,
        deltaPercent: 5,
        beforeMaterialsExGst: 500,
        afterMaterialsExGst: 500,
        beforeInstallExGst: 300,
        afterInstallExGst: 350,
        beforeOverheadExGst: 200,
        afterOverheadExGst: 200,
      },
      draftContentHash: payload.version.contentHash,
      currentVersionId: null,
      generatedAt: '2026-07-23T00:00:00.000Z',
    };
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).startsWith('/api/admin/costing/estimates')) {
        return new Response(JSON.stringify({ estimates: [preview.estimate] }), { status: 200 });
      }
      if (String(url).endsWith('/estimate-preview') && init?.method === 'POST') {
        return new Response(JSON.stringify({ preview }), { status: 200 });
      }
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    const rendered = renderIntoDocument(<CostingControlCentre initialOverview={overview('draft')} />);
    await click(buttonByText(rendered.container, 'Continue draft v1'));
    await click(buttonByText(rendered.container, 'Review impact'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    await click(buttonByText(rendered.container, 'Preview selected estimate'));

    expect(rendered.container.textContent).toContain('Patricia Branch');
    expect(rendered.container.textContent).toContain('Active pricing → saved draft');
    expect(rendered.container.textContent).toContain('Representative project impact');
    expect(fetch.mock.calls.some(([url, init]) => (
      String(url).endsWith('/estimate-preview') && init?.method === 'POST'
    ))).toBe(true);
    rendered.unmount();
  });
});
