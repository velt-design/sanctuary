import type { HouseRoofStageDiagnostics } from '@sp/geometry';
import type {
  HouseFormFootprintModel,
  HouseFormModel,
  HouseFormRoofIntentModel,
} from './state/objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchRoofFailingStage,
  ObjectWorkbenchRoofStatus,
} from './state/objectWorkbenchStatusModel';
import type { ObjectWorkbenchRoofInspectorModel } from './state/objectWorkbenchInspectorModel';

/**
 * PR-HR1 (2026-06-18): designer-facing roof-failure repro payload.
 *
 * Schema-versioned JSON that a designer can save / email / Slack
 * straight from the right-rail validation panel — no dev server, no
 * env flags, no copy-paste of a full debug export. Carries ONLY
 * geometry inputs + diagnostics; no project name, contact, site
 * address, label, or other customer-identifying fields. The same
 * payload shape becomes the canonical regression fixture format for
 * `packages/geometry/src/house/__fixtures__/captured/` (PR-HR4
 * matrix + PR-HR5 fix consume it).
 *
 * Distinct from the existing rich `PortalPageDebugExport` /
 * `workbenchDebugFixture` workflow described in
 * `docs/workbench-captured-repro-workflow.md` — that one is engineer-
 * mediated and includes whole-project state for multi-house repro.
 * This one is single-house, designer-mediated, and geometry-only.
 */
export const ROOF_FAILURE_REPRO_SCHEMA_VERSION = 1 as const;

export type RoofFailureReproFootprint = {
  mode: HouseFormFootprintModel['mode'];
  preset: HouseFormFootprintModel['preset'];
  attachmentSide: HouseFormFootprintModel['attachmentSide'];
  /**
   * Polygon in local-frame, along/depth metres. Carries the exact
   * string representations so the fixture round-trips
   * pixel-accurately (the workbench stores these as strings, not
   * floats).
   */
  polygonLocalM: HouseFormFootprintModel['polygon'];
};

export type RoofFailureReproRoofIntent = Omit<
  HouseFormRoofIntentModel,
  // Deliberate: not omitting any field. Listed for clarity.
  never
>;

export type RoofFailureRepro = {
  schemaVersion: typeof ROOF_FAILURE_REPRO_SCHEMA_VERSION;
  capturedAt: string;
  validationStatus: 'invalid' | 'approximate';
  validationCode: string | null;
  validationMessage: string | null;
  failingStage: ObjectWorkbenchRoofFailingStage | null;
  approximationReasons: string[];
  stageDiagnostics: HouseRoofStageDiagnostics;
  footprint: RoofFailureReproFootprint;
  roofIntent: RoofFailureReproRoofIntent;
  geometryKind: string | null;
  terminalEnds: Array<{ id: string; label: string; isOpen: boolean }>;
};

/**
 * Build the repro payload from the house form + the live roof status.
 * Pure / synchronous / no-side-effect — safe to memoize.
 *
 * Throws when the roof is `valid` or `null` (no failure to report).
 * Callers should gate on `validationStatus` before invoking.
 *
 * `capturedAt` is taken from `options.now ?? new Date().toISOString()`
 * so tests can inject a stable timestamp.
 */
export function buildRoofFailureRepro(
  input: {
    houseForm: HouseFormModel;
    roof: ObjectWorkbenchRoofStatus | ObjectWorkbenchRoofInspectorModel;
  },
  options?: { now?: string },
): RoofFailureRepro {
  const status = input.roof.validationStatus;
  if (status !== 'invalid' && status !== 'approximate') {
    throw new Error(
      `buildRoofFailureRepro: cannot build repro for validationStatus=${String(status)}`,
    );
  }

  const roofIntent = isStatusModel(input.roof) ? statusToIntent(input.roof) : input.roof.intent;

  return {
    schemaVersion: ROOF_FAILURE_REPRO_SCHEMA_VERSION,
    capturedAt: options?.now ?? new Date().toISOString(),
    validationStatus: status,
    validationCode: input.roof.validationCode,
    validationMessage: input.roof.validationMessage,
    failingStage: input.roof.failingStage,
    approximationReasons: input.roof.approximationReasons,
    stageDiagnostics: input.roof.stageDiagnostics,
    footprint: {
      mode: input.houseForm.footprint.mode,
      preset: input.houseForm.footprint.preset,
      attachmentSide: input.houseForm.footprint.attachmentSide,
      polygonLocalM: input.houseForm.footprint.polygon,
    },
    roofIntent,
    geometryKind: input.roof.geometryKind,
    terminalEnds: input.roof.terminalEnds.map((end) => ({
      id: end.id,
      label: end.label,
      isOpen: end.isOpen,
    })),
  };
}

function isStatusModel(
  roof: ObjectWorkbenchRoofStatus | ObjectWorkbenchRoofInspectorModel,
): roof is ObjectWorkbenchRoofStatus {
  return 'form' in roof && 'roofIntentAuthored' in roof;
}

function statusToIntent(roof: ObjectWorkbenchRoofStatus): RoofFailureReproRoofIntent {
  // Reconstruct the intent shape from the flattened status fields.
  // Used only when buildRoofFailureRepro is called with the raw status
  // model rather than the inspector model (e.g. server-side test
  // callers); the rail itself always passes the inspector model.
  return {
    form: roof.form,
    material: 'corrugated_iron',
    primaryPitchDeg: '',
    primaryFallDirection: 'positive_y',
    ridgeAxis: 'x',
    openGableEndIds: roof.terminalEnds.filter((end) => end.isOpen).map((end) => end.id),
  };
}

/**
 * Build a filename that's readable in a downloads folder. No PII —
 * just the stage, code, and a short timestamp.
 */
export function buildRoofFailureReproFilename(payload: RoofFailureRepro): string {
  const stamp = payload.capturedAt.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const stagePart = payload.failingStage?.id ?? payload.validationStatus;
  const codePart = payload.validationCode
    ? `_${payload.validationCode.replace(/[^a-zA-Z0-9_-]/g, '-')}`
    : '';
  return `roof-failure_${stagePart}${codePart}_${stamp}.json`;
}

/**
 * Browser-only helper: serialize the payload and trigger a download.
 * Resolves with the filename used. Falls back to a clipboard write
 * when DOM download is not available (jsdom in tests, restricted
 * iframes); callers can ignore the return value.
 *
 * Kept separate from `buildRoofFailureRepro` so the builder stays
 * pure and unit-testable without DOM mocks.
 */
export function downloadRoofFailureRepro(payload: RoofFailureRepro): string {
  const filename = buildRoofFailureReproFilename(payload);
  const json = JSON.stringify(payload, null, 2);

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return filename;
  }

  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Revoke after a tick so the browser has finished pulling the blob.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch {
    // Fall back to clipboard if Blob/anchor download is blocked.
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(json);
    }
  }

  return filename;
}
