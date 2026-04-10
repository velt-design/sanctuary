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

  it('renders the editable Sanctuary workbench shell for supported mono estimates and supports local view toggles', async () => {
    const estimate = buildEstimateDetail();

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient
        estimate={estimate}
        projectName="Deck Build"
        siteAddress="1 Test Street"
        backHref="/staff/projects/proj_1"
      />,
    );

    expect(rendered.container.textContent).toContain('Sanctuary Controls');
    expect(rendered.container.textContent).toContain('Geometry');
    expect(rendered.container.textContent).toContain('House / Context');
    expect(rendered.container.textContent).toContain('Overrides');
    expect(rendered.container.textContent).toContain('Ledger override');
    expect(rendered.container.textContent).toContain('Sheet View');
    expect(rendered.container.textContent).toContain('Model Space');
    expect(rendered.container.textContent).toContain('3D View');
    expect(rendered.container.textContent).toContain('Back to Project');
    expect(rendered.container.textContent).not.toContain('Flashings');
    expect(rendered.container.textContent).not.toContain('Rotate +90');

    clickButtonByText(rendered.container, '3D View');
    await flushAsyncWork();

    expect(rendered.container.textContent).toContain('Workspace panel');
    expect(rendered.container.textContent).not.toContain('Inspection');
    clickButtonByText(rendered.container, 'Workspace panel');
    expect(rendered.container.textContent).toContain('Snapshot Validated');
    expect(rendered.container.textContent).toContain('Inspection');
    expect(rendered.container.textContent).toContain('Section cut');
    expect(rendered.container.textContent).toContain('Datum axes');
    expect(rendered.container.textContent).toContain('Measurement');
    expect(rendered.container.textContent).toContain('Enable measurement');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).not.toBeNull();

    clickButtonByText(rendered.container, 'Model Space');
    await flushAsyncWork();

    expect(rendered.container.querySelector('[aria-label="Plan model space viewport"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Reset view');
    expect(rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-plan-resize-handle-hit="plan:spanA"]')).not.toBeNull();
    expect(rendered.container.textContent).not.toContain('Rotate +90');

    clickButtonByText(rendered.container, 'Section');
    await flushAsyncWork();

    expect(rendered.container.textContent).toContain('Section model space is staged for a later milestone.');

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
          lockReason: 'Locked by quote send.',
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

    const lengthInput = rendered.container.querySelector('[aria-label="Roof length (m)"]') as HTMLInputElement | null;
    expect(rendered.container.textContent).toContain('Read Only');
    expect(rendered.container.textContent).toContain('Locked by quote send.');
    expect(lengthInput?.disabled).toBe(true);

    clickButtonByText(rendered.container, 'Model Space');
    expect(rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]')).toBeNull();
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

    clickButtonByText(rendered.container, '3D View');
    await flushAsyncWork();

    clickButtonByText(rendered.container, 'Workspace panel');
    expect(rendered.container.textContent).toContain('Draft Resolved Locally');
    expect(rendered.container.textContent).toContain('Inspection');
    expect(rendered.container.textContent).toContain('Section cut');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).not.toBeNull();

    rendered.unmount();
  });

  it('writes house/context edits into the local working copy', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

    await flushAsyncWork();
    changeSelectByLabel(rendered.container, 'House footprint', 'u_shape');
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.inputs.modules[0]?.houseFootprintPreset).toBe('u_shape');
    rendered.unmount();
  });

  it('writes override edits into the local working copy', async () => {
    const estimate = buildEstimateDetail();
    const entityKey = buildEstimateDrawingDraftEntityKey(estimate.id);

    const rendered = renderIntoDocument(
      <DesignWorkbenchEstimateClient estimate={estimate} projectName="Deck Build" siteAddress="1 Test Street" />,
    );

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
    clickButtonByText(rendered.container, 'Model Space');
    await flushAsyncWork();

    const lengthHandle = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]');
    if (!lengthHandle) throw new Error('Missing model-space length handle');

    dispatchPointer(lengthHandle, 'pointerdown', { pointerId: 7, clientX: 0, clientY: 0 });
    dispatchPointer(window, 'pointermove', { pointerId: 7, clientX: 15.333, clientY: 0 });
    dispatchPointer(window, 'pointerup', { pointerId: 7, clientX: 15.333, clientY: 0 });
    await flushAsyncWork();

    expect(getLocalFirstWorkingCopy<any>(entityKey)?.data.inputs.modules[0]?.lengthM).toBe('7');

    dispatchPointer(lengthHandle, 'pointerdown', { pointerId: 8, clientX: 0, clientY: 0 });
    dispatchPointer(window, 'pointermove', { pointerId: 8, clientX: -15.333, clientY: 0 });
    dispatchPointer(window, 'pointerup', { pointerId: 8, clientX: -15.333, clientY: 0 });
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

    expect(rendered.container.textContent).toContain('Draft overlay note for hidden route');
    expect(rendered.container.textContent).not.toContain('Rotate +90');

    rendered.unmount();
  });
});
