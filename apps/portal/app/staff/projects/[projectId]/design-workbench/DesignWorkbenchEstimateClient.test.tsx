import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DesignWorkbenchEstimateClient from './DesignWorkbenchEstimateClient';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftEntityKey } from '@/lib/localFirst/portalEntities';
import {
  __resetLocalFirstStoreForTests,
  __setLocalFirstStorageAdapterForTests,
  createEmptyLocalFirstState,
  ensureLocalFirstStoreReady,
  getLocalFirstWorkingCopy,
  writeLocalFirstWorkingCopy,
} from '@/lib/localFirst/store';
import { buildEstimateDrawingDraftFromSnapshot } from '@/lib/estimates/drawingEdits';
import { ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY } from '@/lib/estimates/costingPayload';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { LocalFirstPersistedState } from '@/lib/localFirst/types';
import { dispatchPointer, installDomGeometryMock, renderIntoDocument } from '../../../../../../../test/reactHarness';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: unknown }) => <div data-testid="geometry-3d-canvas">{children as any}</div>,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
}));

function clickButtonByText(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(label));
  if (!button) throw new Error(`Missing button: ${label}`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function changeSelectByLabel(container: HTMLElement, label: string, value: string) {
  const select = container.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement | null;
  if (!select) throw new Error(`Missing select: ${label}`);
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function fillInputByLabel(container: HTMLElement, label: string, value: string) {
  const input = container.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | null;
  if (!input) throw new Error(`Missing input: ${label}`);
  act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  act(() => {
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  });
}

function clickElement(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function clickPlanFootprintEdge(container: HTMLElement, side: 'rear' | 'front' | 'left' | 'right') {
  const edge = container.querySelector(`[data-footprint-edge="${side}"]`);
  if (!(edge instanceof Element)) throw new Error(`Missing footprint edge: ${side}`);
  clickElement(edge);
}

function fillPlanDimensionInput(container: HTMLElement, value: string, commit: 'enter' | 'blur' = 'enter') {
  const input = container.querySelector('[aria-label="Edit plan dimension"] input') as HTMLInputElement | null;
  if (!input) throw new Error('Missing plan dimension input.');
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) throw new Error('Missing HTMLInputElement value setter.');
  act(() => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (commit === 'enter') {
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
    });
    return;
  }
  act(() => {
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  });
}

function readLabeledValue(container: HTMLElement, label: string): string | null {
  const labelNode = Array.from(container.querySelectorAll('span')).find((node) => node.textContent?.trim() === label);
  return labelNode?.nextElementSibling?.textContent?.trim() ?? null;
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
}

function buildEstimateDetail(input?: {
  fixtureSlug?: 'mono-standard' | 'gable-standard' | 'box-standard';
  mutateSnapshot?: (snapshot: Record<string, unknown> | null) => Record<string, unknown> | null;
  overrides?: Partial<EstimateDetail>;
}): EstimateDetail {
  const fixture = getSanctuaryGeometryWorkbenchFixture(input?.fixtureSlug ?? 'mono-standard');
  if (!fixture) throw new Error('Expected Sanctuary fixture');

  const snapshot = structuredClone(fixture.snapshot);

  return {
    id: fixture.estimate.id,
    projectId: 'proj_11111111-1111-4111-8111-111111111111',
    createdAt: fixture.estimate.createdAt,
    status: fixture.estimate.status,
    summary: {},
    createdBy: null,
    versionLabel: fixture.estimate.versionLabel,
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    calculatorSnapshot: input?.mutateSnapshot ? input.mutateSnapshot(snapshot) : snapshot,
    internalNotes: null,
    editability: {
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedByQuoteVersionId: null,
      lockedByQuoteRef: null,
      lockedByQuoteVersionNumber: null,
      hasDraftQuotes: false,
      draftQuoteCount: 0,
    },
    ...input?.overrides,
  };
}

function buildMultiModuleEstimateDetail(): EstimateDetail {
  const estimate = buildEstimateDetail();
  const snapshot = structuredClone(estimate.calculatorSnapshot) as {
    inputs?: {
      pergolas?: Array<{ id: string; label: string }>;
      modules?: Array<Record<string, unknown>>;
    };
    outputs?: {
      pergolas?: Array<{ id: string; modules: Array<Record<string, unknown>> }>;
    };
  } | null;
  if (!snapshot?.inputs?.modules?.[0] || !snapshot.outputs?.pergolas?.[0]?.modules?.[0]) {
    throw new Error('Expected base mono fixture snapshot.');
  }

  snapshot.inputs.pergolas = [
    { id: 'pergola-1', label: 'Pergola 1' },
    { id: 'pergola-2', label: 'Pergola 2' },
  ];
  snapshot.inputs.modules = [
    structuredClone(snapshot.inputs.modules[0]),
    {
      ...structuredClone(snapshot.inputs.modules[0]),
      pergolaId: 'pergola-2',
      lengthM: '4.5',
      projectionM: '2.5',
    },
  ];
  snapshot.outputs.pergolas = [
    {
      id: 'pergola-1',
      modules: [
        structuredClone(snapshot.outputs.pergolas[0].modules[0]),
        {
          ...structuredClone(snapshot.outputs.pergolas[0].modules[0]),
          derived: {
            ...(snapshot.outputs.pergolas[0].modules[0].derived as Record<string, unknown>),
            length_m: 4.5,
            projection_m: 2.5,
          },
        },
      ],
    },
  ];

  return {
    ...estimate,
    calculatorSnapshot: snapshot as Record<string, unknown>,
  };
}

type SvgGeometryRestore = {
  restoreCreateSvgPoint: (() => void) | null;
  restoreGetScreenCtm: (() => void) | null;
};

function installSvgGeometryMock(): SvgGeometryRestore {
  const proto = globalThis.SVGSVGElement?.prototype;
  if (!proto) {
    return {
      restoreCreateSvgPoint: null,
      restoreGetScreenCtm: null,
    };
  }

  const originalCreateSvgPoint = proto.createSVGPoint;
  const originalGetScreenCTM = proto.getScreenCTM;

  Object.defineProperty(proto, 'createSVGPoint', {
    configurable: true,
    value() {
      const point = {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: point.x, y: point.y };
        },
      };
      return point;
    },
  });

  Object.defineProperty(proto, 'getScreenCTM', {
    configurable: true,
    value() {
      return {
        inverse() {
          return {};
        },
      };
    },
  });

  return {
    restoreCreateSvgPoint: () => {
      Object.defineProperty(proto, 'createSVGPoint', {
        configurable: true,
        value: originalCreateSvgPoint,
      });
    },
    restoreGetScreenCtm: () => {
      Object.defineProperty(proto, 'getScreenCTM', {
        configurable: true,
        value: originalGetScreenCTM,
      });
    },
  };
}

describe('DesignWorkbenchEstimateClient', () => {
  let restoreGeometry: (() => void) | null = null;
  let restoreSvgGeometry: SvgGeometryRestore | null = null;
  let persisted: LocalFirstPersistedState;

  beforeEach(() => {
    restoreGeometry = installDomGeometryMock();
    restoreSvgGeometry = installSvgGeometryMock();
    persisted = createEmptyLocalFirstState();
    __setLocalFirstStorageAdapterForTests({
      get: async () => structuredClone(persisted),
      set: async (state) => {
        persisted = structuredClone(state);
      },
    });
    __resetLocalFirstStoreForTests();
  });

  afterEach(() => {
    restoreGeometry?.();
    restoreGeometry = null;
    restoreSvgGeometry?.restoreCreateSvgPoint?.();
    restoreSvgGeometry?.restoreGetScreenCtm?.();
    restoreSvgGeometry = null;
    document.body.innerHTML = '';
    __resetLocalFirstStoreForTests();
    __setLocalFirstStorageAdapterForTests(null);
  });

  it('renders the house-first hidden workbench shell and keeps the Sanctuary editor behind pergolas mode', async () => {
    const estimate = buildEstimateDetail();

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient
        estimate={estimate}
        projectName="Deck Build"
        siteAddress="1 Test Street"
        backHref="/staff/projects/proj_1"
      />,
    );

    expect(rendered.container.textContent).toContain('House Configurator');
    expect(rendered.container.textContent).toContain('Footprint');
    expect(rendered.container.textContent).toContain('Migration diagnostics');
    expect(rendered.container.textContent).toContain('Derived houses');
    expect(rendered.container.textContent).toContain('Pergolas');
    expect(rendered.container.textContent).toContain('Sheet View');
    expect(rendered.container.textContent).toContain('Model Space');
    expect(rendered.container.textContent).toContain('3D View');
    expect(rendered.container.textContent).toContain('Back to Project');
    expect(rendered.container.textContent).not.toContain('Sanctuary Controls');

    expect(rendered.container.textContent).toContain('Workspace panel');
    expect(rendered.container.textContent).not.toContain('Inspection');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="scene-object-house-solid-house-wall-1"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="scene-object-outer-gutter"]')).toBeNull();

    clickButtonByText(rendered.container, 'Pergolas');
    await flushAsyncWork();

    expect(rendered.container.querySelector('[data-testid="scene-object-outer-gutter"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Sanctuary Controls');
    expect(rendered.container.textContent).toContain('Geometry');
    expect(rendered.container.textContent).toContain('House / Context');
    expect(rendered.container.textContent).toContain('Overrides');
    expect(rendered.container.textContent).toContain('Ledger override');
    clickButtonByText(rendered.container, 'Workspace panel');
    expect(rendered.container.textContent).toContain('Snapshot Validated');
    expect(rendered.container.textContent).toContain('Inspection');
    expect(rendered.container.textContent).toContain('Section cut');
    expect(rendered.container.textContent).toContain('Datum axes');
    expect(rendered.container.textContent).toContain('Measurement');
    expect(rendered.container.textContent).toContain('Enable measurement');

    clickButtonByText(rendered.container, 'Model Space');
    await flushAsyncWork();

    expect(rendered.container.querySelector('[aria-label="Plan model space viewport"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Fit view');
    expect(rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-plan-resize-handle-hit="plan:spanA"]')).not.toBeNull();

    clickButtonByText(rendered.container, 'Section');
    await flushAsyncWork();

    expect(rendered.container.querySelector('[aria-label="Section model space viewport"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Module section view"]')).not.toBeNull();

    rendered.unmount();
  });

  it('renders the Sanctuary rail for supported gable and box estimates', () => {
    const gableRendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient
        estimate={buildEstimateDetail({ fixtureSlug: 'gable-standard' })}
        projectName="Deck Build"
        siteAddress="1 Test Street"
      />,
    );

    clickButtonByText(gableRendered.container, 'Pergolas');
    expect(gableRendered.container.textContent).toContain('Pergola family');
    expect(gableRendered.container.textContent).not.toContain('not supported for Sanctuary editing yet');
    gableRendered.unmount();

    const boxRendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient
        estimate={buildEstimateDetail({ fixtureSlug: 'box-standard' })}
        projectName="Deck Build"
        siteAddress="1 Test Street"
      />,
    );

    clickButtonByText(boxRendered.container, 'Pergolas');
    const pitchInput = boxRendered.container.querySelector('[aria-label="Roof pitch (deg)"]') as HTMLInputElement | null;
    expect(boxRendered.container.textContent).toContain('Box perimeter');
    expect(pitchInput?.disabled).toBe(true);
    boxRendered.unmount();
  });

  it('renders unsupported geometry as view-only without the Sanctuary rail', () => {
    const estimate = buildEstimateDetail({
      mutateSnapshot: (snapshot) => {
        const next = structuredClone(snapshot);
        const inputs = (next as { inputs?: { modules?: Array<Record<string, unknown>> } } | null)?.inputs;
        if (inputs?.modules?.[0]) {
          inputs.modules[0].pergolaStyle = 'hip';
          inputs.modules[0].boxPerimeterEnabled = false;
        }
        return next;
      },
    });

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    expect(rendered.container.textContent).toContain('House Configurator');
    clickButtonByText(rendered.container, 'Pergolas');
    expect(rendered.container.textContent).toContain('Editing Deferred');
    expect(rendered.container.textContent).toContain('not supported for Sanctuary editing yet');
    expect(rendered.container.textContent).not.toContain('Pergola family');

    clickButtonByText(rendered.container, 'Model Space');
    expect(rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]')).toBeNull();
    rendered.unmount();
  });

  it('renders locked estimates as read-only', () => {
    const estimate = buildEstimateDetail({
      overrides: {
        editability: {
          isLocked: true,
          lockReason: 'Locked by quote send.' as any,
          lockedAt: null,
          lockedByQuoteVersionId: null,
          lockedByQuoteRef: null,
          lockedByQuoteVersionNumber: null,
          hasDraftQuotes: false,
          draftQuoteCount: 0,
        },
      },
    });

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    const footprintSelect = rendered.container.querySelector('[aria-label="House footprint"]') as HTMLSelectElement | null;
    expect(rendered.container.textContent).toContain('Read Only');
    expect(rendered.container.textContent).toContain('Locked by quote send.');
    expect(footprintSelect?.disabled).toBe(true);

    clickButtonByText(rendered.container, 'Model Space');
    expect(rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]')).toBeNull();
    rendered.unmount();
  });

  it('renders approximate roof diagnostics and field sources for inferred house roofs', () => {
    const estimate = buildEstimateDetail();

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    expect(readLabeledValue(rendered.container, 'Roof status')).toBe('Approximate');
    expect(readLabeledValue(rendered.container, 'Roof approximation reasons')).toContain(
      'Roof form inferred from legacy pergola data',
    );
    expect(readLabeledValue(rendered.container, 'Roof form source')).toBe('Legacy pergola inference');
    expect(readLabeledValue(rendered.container, 'Roof material source')).toBe('Legacy shared value');
    expect(readLabeledValue(rendered.container, 'Roof fall source')).toBe('Default fallback');
    expect(readLabeledValue(rendered.container, 'Roof ridge source')).toBe('Default fallback');
    expect(readLabeledValue(rendered.container, 'Roof appendage source')).toBe('Default fallback');
    expect(readLabeledValue(rendered.container, 'Roof geometry')).toBe('Footprint mono');
    expect(readLabeledValue(rendered.container, 'Appendage support')).toBe('Supported');
    expect(readLabeledValue(rendered.container, 'Appendage supported edges')).toBe('Rear');

    rendered.unmount();
  });

  it('keeps blocked roof diagnostics for unsupported house roof topology', () => {
    const estimate = buildEstimateDetail({
      mutateSnapshot: (snapshot) => {
        const next = structuredClone(snapshot) as {
          inputs?: { modules?: Array<Record<string, unknown>> };
        } | null;
        const module = next?.inputs?.modules?.[0];
        if (module) {
          module.houseFootprintMode = 'custom_polygon';
          module.houseFootprintPolygon = [
            { alongM: '0', depthM: '-1.8' },
            { alongM: '6', depthM: '-1.8' },
            { alongM: '4.2', depthM: '0.6' },
            { alongM: '0', depthM: '0' },
          ];
        }
        return next as Record<string, unknown> | null;
      },
    });

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    expect(readLabeledValue(rendered.container, 'Roof status')).toBe('Blocked');
    expect(readLabeledValue(rendered.container, 'Roof reason code')).toBe('unsupported_roof_topology');

    rendered.unmount();
  });

  it('shows shared attachment-zone diagnostics and unresolved pergola counts when side openings block a zone', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);
    const draft = buildEstimateDrawingDraftFromSnapshot(estimate.calculatorSnapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-slider-rear',
          kind: 'slider',
          wallId: 'rear',
          widthM: '2.4',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '0.8',
        },
      ],
    };
    await ensureLocalFirstStoreReady();
    await writeLocalFirstWorkingCopy({
      entityKey,
      data: draft,
    });

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );
    await flushAsyncWork();

    expect(Number(readLabeledValue(rendered.container, 'Attachment zones') ?? '0')).toBeGreaterThan(0);
    expect(readLabeledValue(rendered.container, 'Attachment zone kinds')).toContain('front: wall, soffit, fascia');
    expect(readLabeledValue(rendered.container, 'Attachment zone blocks')).toContain(
      'rear soffit (side_openings_block_roof_zone)',
    );
    expect(readLabeledValue(rendered.container, 'Resolved pergola zones')).toBe('0');
    expect(readLabeledValue(rendered.container, 'Unresolved pergola zones')).toBe('1');
    expect(readLabeledValue(rendered.container, 'Warnings')).toBe('1');
    expect(readLabeledValue(rendered.container, '3D unresolved pergola zones')).toBe('1');

    rendered.unmount();
  });

  it('writes module edits into the local working copy and clears them when reverted to the snapshot', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    expect(getLocalFirstWorkingCopy(entityKey)).toBeNull();

    clickButtonByText(rendered.container, 'Pergolas');
    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'Roof material', 'timber');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.inputs.modules[0]?.roofMaterial).toBe('timber');

    changeSelectByLabel(rendered.container, 'Roof material', 'acrylic');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy(entityKey)).toBeNull();
    rendered.unmount();
  });

  it('shows the locally resolved 3D preview warning when local geometry edits exist', async () => {
    const estimate = buildEstimateDetail({ fixtureSlug: 'mono-standard' });
    const baseDraft = buildEstimateDrawingDraftFromSnapshot(estimate.calculatorSnapshot);
    if (!baseDraft) throw new Error('Expected drawing draft');

    const draft = structuredClone(baseDraft);
    draft.inputs.modules[0]!.lengthM = '6.4';

    await ensureLocalFirstStoreReady();
    await writeLocalFirstWorkingCopy({
      entityKey: buildEstimateDrawingDraftEntityKey(estimate.id),
      data: draft,
    });

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();

    expect(rendered.container.textContent).toContain('3D Preview Resolved Locally');

    clickButtonByText(rendered.container, 'Workspace panel');
    expect(rendered.container.textContent).toContain('Draft Resolved Locally');
    expect(rendered.container.textContent).toContain('Inspection');
    expect(rendered.container.textContent).toContain('Section cut');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).not.toBeNull();

    rendered.unmount();
  });

  it('renders Sheet View from locally resolved stale pricing outputs', async () => {
    const estimate = buildEstimateDetail({
      mutateSnapshot: (snapshot) => {
        const next = structuredClone(snapshot) as {
          inputs?: { modules?: Array<{ lengthM?: string }> };
          outputs?: Record<string, unknown>;
        } | null;
        if (!next?.inputs?.modules?.[0] || !next.outputs) return next as Record<string, unknown> | null;
        next.inputs.modules[0].lengthM = '8.4';
        next.outputs[ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY] = 'stale';
        return next as Record<string, unknown>;
      },
    });

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Sheet View');
    await flushAsyncWork();

    expect(rendered.container.querySelector('[aria-label="Plan view A3 drawing sheet"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Module plan view"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('8.40m');
    expect(rendered.container.textContent).not.toContain('Waiting for valid inputs before geometry is available.');

    rendered.unmount();
  });

  it('writes house/context edits into the local working copy', async () => {
    const estimate = buildMultiModuleEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'House footprint', 'u_shape');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.inputs.modules[0]?.houseFootprintPreset).toBe('u_shape');
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.inputs.modules[1]?.houseFootprintPreset).toBe('u_shape');
    rendered.unmount();
  });

  it('writes shared roof edits into the local working copy and surfaces blocked topology', async () => {
    const estimate = buildMultiModuleEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    expect(rendered.container.textContent).toContain('Mono fall direction');
    expect(rendered.container.textContent).not.toContain('Gable ridge orientation');
    const roofFormSelect = rendered.container.querySelector('[aria-label="Roof form"]') as HTMLSelectElement | null;
    expect(Array.from(roofFormSelect?.options ?? []).map((option) => option.value)).toEqual(['mono', 'gable']);
    changeSelectByLabel(rendered.container, 'Roof form', 'gable');
    await flushAsyncWork();
    fillInputByLabel(rendered.container, 'Roof pitch (deg)', '18');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.roof?.form).toBe('gable');
    expect(rendered.container.textContent).not.toContain('Mono fall direction');
    expect(rendered.container.textContent).toContain('Gable ridge orientation');
    expect(readLabeledValue(rendered.container, 'Selected roof form')).toBe('gable');
    expect(rendered.container.textContent).toContain('Roof status');
    expect(rendered.container.textContent).toContain('Ready');
    expect(readLabeledValue(rendered.container, 'Roof reason code')).toBe('none');

    changeSelectByLabel(rendered.container, 'House footprint', 'u_shape');
    await flushAsyncWork();

    expect(rendered.container.textContent).toContain('Ready');
    expect(readLabeledValue(rendered.container, 'Roof reason code')).toBe('none');

    rendered.unmount();
  });

  it('blocks explicit mono fall directions that drain back into the attachment side', async () => {
    const estimate = buildEstimateDetail();
    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'Mono fall direction', 'positive_y');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Roof status')).toBe('Blocked');
    expect(readLabeledValue(rendered.container, 'Roof reason code')).toBe('invalid_mono_fall_direction');
    expect(rendered.container.textContent).toContain(
      'This mono fall direction drains back into the attachment side.',
    );

    rendered.unmount();
  });

  it('blocks explicit ridge orientations that do not match the current footprint span', async () => {
    const estimate = buildEstimateDetail();
    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'Roof form', 'gable');
    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'Gable ridge orientation', 'y');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Roof status')).toBe('Blocked');
    expect(readLabeledValue(rendered.container, 'Roof reason code')).toBe('invalid_ridge_axis');
    expect(rendered.container.textContent).toContain(
      'This ridge orientation does not match the current house footprint.',
    );

    rendered.unmount();
  });

  it('keeps legacy flat roofs readable but view-only in house mode', async () => {
    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient
        estimate={buildEstimateDetail({ fixtureSlug: 'box-standard' })}
        projectName="Deck Build"
        siteAddress="1 Test Street"
      />,
    );

    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Selected roof form')).toBe('flat');
    expect(rendered.container.textContent).toContain('Current roof family');
    expect(rendered.container.textContent).toContain('View-only for now');
    expect(rendered.container.textContent).toContain(
      'Only mono and gable are first-pass editable in house mode for this milestone.',
    );
    expect(rendered.container.querySelector('[aria-label="Roof form"]')).toBeNull();
    expect(rendered.container.textContent).not.toContain('Roof pitch (deg)');

    rendered.unmount();
  });

  it('surfaces appendage invalid diagnostics without changing the house roof family set', async () => {
    const estimate = buildMultiModuleEstimateDetail();
    const snapshot = structuredClone(estimate.calculatorSnapshot) as {
      inputs?: { modules?: Array<Record<string, unknown>> };
    } | null;
    for (const module of snapshot?.inputs?.modules ?? []) {
      module.houseConnectionType = 'facade';
      module.houseAttachmentStrategy = 'facade_ledger';
    }

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient
        estimate={{
          ...estimate,
          calculatorSnapshot: (snapshot ?? estimate.calculatorSnapshot) as Record<string, unknown>,
        }}
        projectName="Deck Build"
        siteAddress="1 Test Street"
      />,
    );

    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'House footprint', 'u_shape');
    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'Appendage band', 'enabled');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Selected roof form')).toBe('mono');
    expect(readLabeledValue(rendered.container, 'Roof appendage')).toBe('invalid');
    expect(readLabeledValue(rendered.container, 'Roof reason code')).toBe('invalid_appendage_topology');
    expect(readLabeledValue(rendered.container, 'Appendage supported edges')).toBe('None');
    expect(rendered.container.textContent).toContain(
      'Appendage bands require at least one continuous exterior perimeter run on the current house footprint.',
    );

    rendered.unmount();
  });

  it('shows orthogonal mono presets as non-blocked in house mode diagnostics', async () => {
    const estimate = buildEstimateDetail();

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'House footprint', 'u_shape');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Selected roof form')).toBe('mono');
    expect(readLabeledValue(rendered.container, 'Roof status')).toBe('Approximate');
    expect(readLabeledValue(rendered.container, 'Roof reason code')).toBe('none');
    expect(rendered.container.textContent).not.toContain('Mono roofs currently require eave-based house attachment on an outer footprint edge for this footprint.');

    rendered.unmount();
  });

  it('adds, selects, and removes shared decks while updating diagnostics', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    expect(readLabeledValue(rendered.container, 'Deck count')).toBe('0');
    expect(readLabeledValue(rendered.container, 'Selected deck id')).toBe('none');

    clickButtonByText(rendered.container, 'Add deck');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.decks?.map((deck: any) => deck.id)).toEqual(['deck-1']);
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.decks?.[0]?.presetRect).toEqual({
      widthM: '6',
      depthM: '3',
      centerOffsetM: '0',
    });
    expect(readLabeledValue(rendered.container, 'Deck count')).toBe('1');
    expect(readLabeledValue(rendered.container, 'Active host side')).toBe('rear');
    expect(readLabeledValue(rendered.container, 'Active-side deck present')).toBe('Yes');
    expect(readLabeledValue(rendered.container, 'Deck support class')).toBe('threshold_attached');
    expect(readLabeledValue(rendered.container, 'Deck bracket eligible')).toBe('Yes');
    expect(readLabeledValue(rendered.container, '3D deck class')).toBe('threshold_attached');
    expect(readLabeledValue(rendered.container, '3D deck bracket')).toBe('Yes');
    expect(readLabeledValue(rendered.container, 'Selected deck id')).toBe('deck-1');
    expect(readLabeledValue(rendered.container, 'House polygon source')).toBe('preset_derived');
    expect(readLabeledValue(rendered.container, 'Selected deck type')).toBe('preset_snapped');
    expect(readLabeledValue(rendered.container, 'Deck drag eligible')).toBe('Yes');
    expect(readLabeledValue(rendered.container, 'Deck host-edge resolvable')).toBe('Yes');
    expect(readLabeledValue(rendered.container, 'Deck relationship dims')).toBe('Yes');

    clickButtonByText(rendered.container, 'Model Space');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Model-space house polygon')).toBe('preset_derived');
    expect(readLabeledValue(rendered.container, 'Model-space deck type')).toBe('preset_snapped');
    expect(readLabeledValue(rendered.container, 'Model-space drag eligible')).toBe('Yes');
    expect(readLabeledValue(rendered.container, 'Model-space relationship dims')).toBe('Yes');
    expect(readLabeledValue(rendered.container, 'Model-space snap state')).toBe('idle');

    clickButtonByText(rendered.container, 'Add deck');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.decks?.map((deck: any) => deck.id)).toEqual([
      'deck-1',
      'deck-2',
    ]);
    expect(readLabeledValue(rendered.container, 'Deck count')).toBe('2');
    expect(readLabeledValue(rendered.container, 'Selected deck id')).toBe('deck-2');
    expect(readLabeledValue(rendered.container, 'Selected deck type')).toBe('preset_snapped');
    expect(readLabeledValue(rendered.container, 'Deck drag eligible')).toBe('Yes');
    expect(readLabeledValue(rendered.container, 'Deck relationship dims')).toBe('Yes');

    clickButtonByText(rendered.container, 'Deck 1');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Selected deck id')).toBe('deck-1');
    expect(readLabeledValue(rendered.container, 'Selected deck type')).toBe('preset_snapped');

    clickButtonByText(rendered.container, 'Remove deck');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.decks?.map((deck: any) => deck.id)).toEqual(['deck-2']);
    expect(readLabeledValue(rendered.container, 'Deck count')).toBe('1');
    expect(readLabeledValue(rendered.container, 'Selected deck id')).toBe('none');
    rendered.unmount();
  });

  it('adds windows in house mode, selects them in model space, and commits width edits through plan dimensions', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Window Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    expect(readLabeledValue(rendered.container, 'Opening count')).toBe('0');
    expect(readLabeledValue(rendered.container, 'Slider openings')).toBe('0');
    expect(readLabeledValue(rendered.container, 'Selected opening id')).toBe('none');

    clickButtonByText(rendered.container, 'Add window');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.map((opening: any) => opening.id)).toEqual([
      'opening-1',
    ]);
    expect(readLabeledValue(rendered.container, 'Opening count')).toBe('1');
    expect(readLabeledValue(rendered.container, 'Slider openings')).toBe('0');
    expect(readLabeledValue(rendered.container, 'Selected opening id')).toBe('opening-1');

    clickButtonByText(rendered.container, 'Model Space');
    await flushAsyncWork();

    const openingShape = rendered.container.querySelector('[data-house-first-shape-hit="opening:opening-1"]');
    if (!(openingShape instanceof Element)) throw new Error('Missing window opening shape.');
    clickElement(openingShape);
    await flushAsyncWork();

    const widthLabel = rendered.container.querySelector('[data-editable-field-id="opening-1:widthM"]');
    if (!(widthLabel instanceof Element)) throw new Error('Missing window width dimension.');
    clickElement(widthLabel);
    fillPlanDimensionInput(rendered.container, '2.4');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0]?.widthM).toBe('2.4');
    expect(rendered.container.querySelector('[data-editable-field-id="opening-1:widthM"]')?.textContent).toContain('2.40m');

    clickButtonByText(rendered.container, 'Remove opening');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings ?? []).toEqual([]);
    expect(readLabeledValue(rendered.container, 'Opening count')).toBe('0');
    expect(readLabeledValue(rendered.container, 'Selected opening id')).toBe('none');

    rendered.unmount();
  });

  it('shows 3D opening marker diagnostics for valid and invalid shared-house openings', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Window Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Add window');
    await flushAsyncWork();

    fillInputByLabel(rendered.container, 'Opening width (m)', '20');
    await flushAsyncWork();

    clickButtonByText(rendered.container, 'Add window');
    await flushAsyncWork();

    const openingDrafts = getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings ?? [];
    expect(openingDrafts.map((opening: any) => opening.id)).toEqual(['opening-1', 'opening-2']);

    fillInputByLabel(rendered.container, 'Opening width (m)', '2.4');
    fillInputByLabel(rendered.container, 'Opening height (m)', '1.2');
    fillInputByLabel(rendered.container, 'Opening base height (m)', '0.9');
    fillInputByLabel(rendered.container, 'Offset along wall (m)', '1.1');
    await flushAsyncWork();

    clickButtonByText(rendered.container, '3D View');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, '3D opening count')).toBe('2');
    expect(readLabeledValue(rendered.container, '3D valid openings')).toBe('1');
    expect(readLabeledValue(rendered.container, '3D host edges resolved')).toBe('1');
    expect(readLabeledValue(rendered.container, '3D host edges unresolved')).toBe('0');
    expect(readLabeledValue(rendered.container, '3D rendered markers')).toBe('1');
    expect(readLabeledValue(rendered.container, '3D skipped invalid')).toBe('1');
    expect(readLabeledValue(rendered.container, '3D unresolved valid')).toBe('0');

    rendered.unmount();
  });

  it('adds sliders in house mode and preserves slider-specific panel count edits', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Slider Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Add slider');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Opening count')).toBe('1');
    expect(readLabeledValue(rendered.container, 'Slider openings')).toBe('1');
    expect(readLabeledValue(rendered.container, 'Selected opening id')).toBe('opening-1');
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0]).toMatchObject({
      kind: 'slider',
      panelCount: 2,
      widthM: '2.4',
      heightM: '2.1',
      sillHeightM: '0',
    });

    changeSelectByLabel(rendered.container, 'Panel count', '4');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0]?.panelCount).toBe(4);

    rendered.unmount();
  });

  it('adds hinged doors and stackers in house mode with the expected defaults', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Opening Families" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Add door');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Selected opening id')).toBe('opening-1');
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0]).toMatchObject({
      kind: 'hinged_door',
      widthM: '0.9',
      heightM: '2.1',
      sillHeightM: '0',
      offsetAlongWallM: '0.6',
    });

    clickButtonByText(rendered.container, 'Add stacker');
    await flushAsyncWork();

    expect(readLabeledValue(rendered.container, 'Selected opening id')).toBe('opening-2');
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[1]).toMatchObject({
      kind: 'stacker',
      widthM: '3.6',
      heightM: '2.1',
      sillHeightM: '0',
      offsetAlongWallM: '0.6',
    });

    rendered.unmount();
  });

  it('normalizes opening panel counts when switching between all four opening families', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Opening Kinds" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Add window');
    await flushAsyncWork();

    changeSelectByLabel(rendered.container, 'Opening type', 'slider');
    await flushAsyncWork();
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0]).toMatchObject({
      kind: 'slider',
      panelCount: 2,
      widthM: '1.8',
      heightM: '1.2',
      sillHeightM: '0.9',
      offsetAlongWallM: '0.6',
    });

    changeSelectByLabel(rendered.container, 'Panel count', '4');
    await flushAsyncWork();
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0]?.panelCount).toBe(4);

    changeSelectByLabel(rendered.container, 'Opening type', 'stacker');
    await flushAsyncWork();
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0]).toMatchObject({
      kind: 'stacker',
      widthM: '1.8',
      heightM: '1.2',
      sillHeightM: '0.9',
      offsetAlongWallM: '0.6',
    });

    changeSelectByLabel(rendered.container, 'Opening type', 'hinged_door');
    await flushAsyncWork();
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0]).toMatchObject({
      kind: 'hinged_door',
    });

    changeSelectByLabel(rendered.container, 'Opening type', 'window');
    await flushAsyncWork();
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0]).toMatchObject({
      kind: 'window',
      widthM: '1.8',
      heightM: '1.2',
      sillHeightM: '0.9',
      offsetAlongWallM: '0.6',
    });

    rendered.unmount();
  });

  it('preserves a typed opening kind when editing non-kind fields from a local working copy', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);
    const baseDraft = buildEstimateDrawingDraftFromSnapshot(estimate.calculatorSnapshot);
    if (!baseDraft) throw new Error('Expected drawing draft');

    await ensureLocalFirstStoreReady();
    await writeLocalFirstWorkingCopy({
      entityKey,
      data: {
        ...baseDraft,
        houseFirst: {
          ...baseDraft.houseFirst,
          openings: [
            {
              id: 'opening-1',
              label: 'Rear slider',
              kind: 'slider',
              panelCount: 4,
              wallId: 'rear',
              widthM: '2.4',
              heightM: '2.1',
              sillHeightM: '0',
              offsetAlongWallM: '0.8',
            },
          ],
        },
      },
    });

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Opening Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'House');
    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Model Space');
    await flushAsyncWork();

    const openingShape = rendered.container.querySelector('[data-house-first-shape-hit="opening:opening-1"]');
    if (!(openingShape instanceof Element)) throw new Error('Missing typed opening shape.');
    clickElement(openingShape);
    await flushAsyncWork();

    const widthLabel = rendered.container.querySelector('[data-editable-field-id="opening-1:widthM"]');
    if (!(widthLabel instanceof Element)) throw new Error('Missing typed opening width dimension.');
    clickElement(widthLabel);
    fillPlanDimensionInput(rendered.container, '2.8');
    await flushAsyncWork();

    const openingDraft = getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.openings?.[0];
    expect(openingDraft?.kind).toBe('slider');
    expect(openingDraft?.panelCount).toBe(4);
    expect(openingDraft?.widthM).toBe('2.8');

    rendered.unmount();
  });

  it('edits preset decks and hides deck controls in pergolas mode', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Add deck');
    await flushAsyncWork();

    fillInputByLabel(rendered.container, 'Width (m)', '20');
    await flushAsyncWork();
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.decks?.[0]?.presetRect?.widthM).toBe('6');

    changeSelectByLabel(rendered.container, 'Shape', 'custom');
    await flushAsyncWork();
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.decks?.[0]?.shape).toBe('custom');
    expect(rendered.container.querySelector('[aria-label="Width (m)"]')).toBeNull();

    changeSelectByLabel(rendered.container, 'Shape', 'preset');
    await flushAsyncWork();
    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.houseFirst?.decks?.[0]?.shape).toBe('preset');
    expect(rendered.container.querySelector('[aria-label="Width (m)"]')).not.toBeNull();
    expect(readLabeledValue(rendered.container, 'Invalid decks')).toBe('0');

    clickButtonByText(rendered.container, 'Pergolas');
    await flushAsyncWork();

    expect(rendered.container.textContent).toContain('Pergola Mode');
    expect(rendered.container.textContent).not.toContain('Add deck');
    expect(rendered.container.textContent).not.toContain('Deck placement');
    rendered.unmount();
  });

  it('writes override edits into the local working copy', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Pergolas');
    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'Ledger override', '100x50');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.inputs.modules[0]?.overrides?.ledgerProfile).toBe('100x50');
    rendered.unmount();
  });

  it('updates and clears the local working copy from model-space primary-size drag handles', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Pergolas');
    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Model Space');
    await flushAsyncWork();

    const lengthHandle = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]');
    if (!lengthHandle) throw new Error('Missing model-space length handle');

    dispatchPointer(lengthHandle, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 0 });
    dispatchPointer(window, 'pointermove', { pointerId: 7, clientX: 15.333, clientY: 0 });
    dispatchPointer(window, 'pointerup', { pointerId: 7, clientX: 15.333, clientY: 0 });
    await flushAsyncWork();

    const firstDraftLength = Number.parseFloat(getLocalFirstWorkingCopy<any>(entityKey)?.data.inputs.modules[0]?.lengthM ?? '');
    expect(firstDraftLength).toBeGreaterThan(6);

    const currentLengthHandle = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]');
    if (!currentLengthHandle) throw new Error('Missing updated model-space length handle');
    const handleWidth = Math.abs(
      Number.parseFloat(currentLengthHandle.getAttribute('x2') ?? '0') -
        Number.parseFloat(currentLengthHandle.getAttribute('x1') ?? '0'),
    );
    const currentScale = handleWidth / (firstDraftLength * 0.44);
    const returnToSnapshotDelta = (6 - firstDraftLength) * currentScale;

    dispatchPointer(currentLengthHandle, 'pointerdown', { pointerId: 8, clientX: 0, clientY: 0 });
    dispatchPointer(window, 'pointermove', { pointerId: 8, clientX: returnToSnapshotDelta, clientY: 0 });
    dispatchPointer(window, 'pointerup', { pointerId: 8, clientX: returnToSnapshotDelta, clientY: 0 });
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy(entityKey)).toBeNull();
    rendered.unmount();
  });

  it('overlays a local drawing draft working copy onto the visible sheet metadata', async () => {
    const estimate = buildEstimateDetail();
    const baseDraft = buildEstimateDrawingDraftFromSnapshot(estimate.calculatorSnapshot);
    if (!baseDraft) throw new Error('Expected drawing draft');

    await ensureLocalFirstStoreReady();
    await writeLocalFirstWorkingCopy({
      entityKey: buildEstimateDrawingDraftEntityKey(estimate.id),
      data: {
        ...baseDraft,
        overrides: {
          ...baseDraft.overrides,
          noteOverride: 'Draft overlay note for hidden route',
        },
      },
    });

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    clickButtonByText(rendered.container, 'Sheet View');
    await flushAsyncWork();

    expect(rendered.container.textContent).toContain('Draft overlay note for hidden route');

    rendered.unmount();
  });

  it('shows mode diagnostics while keeping pergola fallback editing available', async () => {
    const estimate = buildEstimateDetail();

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    expect(rendered.container.textContent).toContain('Migration diagnostics');
    expect(rendered.container.textContent).toContain('Derived houses');
    expect(rendered.container.textContent).toContain('Low confidence');

    clickButtonByText(rendered.container, 'Pergolas');
    await flushAsyncWork();

    expect(rendered.container.textContent).toContain('Pergola Mode');
    expect(rendered.container.textContent).toContain('Sanctuary Controls');
    rendered.unmount();
  });
});
