import {
  buildHouseModel3DFromRawHouseInput,
  deriveHouseGableTerminalEnds,
  deriveHouseRoofCapabilities,
  deriveHouseRoofGeometryKind,
  EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
  firstHouseRoofStageDiagnosticCode,
  getHouseRoofFormBehavior,
  preferredMonoFallDirectionForAttachmentSide,
  summarizeHouseModelRoofStageDiagnostics,
  validateHouseRoofSelection,
  type HouseRoofStageDiagnostics,
  type Polygon3,
} from "@sp/geometry";
import type {
  CalculatorHouseAttachmentStrategy,
  CalculatorHouseFootprintPolygonPoint,
} from "@/lib/types/calculator";
import {
  resolveDeckInteractionCapability,
  type DeckInteractionCapability,
} from "@/lib/drawings/interactions/deckInteractionContract";
import type { WorkbenchDeckSupportDiagnostic } from "./deckSupportDiagnostics";
import type {
  DeckObjectModel,
  HouseFormModel,
  HouseFormRoofIntentModel,
  OpeningObjectModel,
  PergolaObjectModel,
  WorkbenchProjectModel,
} from "./objectFirstWorkbenchModel";
import { connectionKindFromAttachment } from "./pergolaAttachment";
import { resolveHouseFormRoofIntentForFootprint } from "./houseFormRoofIntentForFootprint";
import { buildHouseFormRawGeometryInput } from "./houseFormRawGeometry";

type AttachmentSide = "rear" | "front" | "left" | "right";

const ATTACHMENT_SIDES: readonly AttachmentSide[] = [
  "rear",
  "front",
  "left",
  "right",
];

export type ObjectWorkbenchMigrationWarning = {
  id: string;
  code: string;
  field: string;
  message: string;
  severity: "blocking";
};

export type ObjectWorkbenchRoofProvenance = Partial<
  Record<
    | "form"
    | "material"
    | "primaryPitchDeg"
    | "primaryFallDirection"
    | "ridgeAxis"
    | "openGableEndIds",
    string | null
  >
>;

/**
 * PR-HR2 (2026-06-18): the human-readable label of the stage that
 * first reported a failure. Derived once from the geometry stage
 * diagnostics so the inspector rail can render "failed at: eave
 * polygon construction" without re-pattern-matching the codes.
 */
export type ObjectWorkbenchRoofFailingStageId =
  | "footprint_normalization"
  | "eave_polygon_construction"
  | "roof_intent_normalization"
  | "roof_topology_classification"
  | "roof_topology_coverage"
  | "roof_plane_generation"
  | "roof_wavefront"
  | "roof_qa_validation"
  | "eave_offset_repair";

export type ObjectWorkbenchRoofFailingStage = {
  id: ObjectWorkbenchRoofFailingStageId;
  label: string;
  code: string;
};

export type ObjectWorkbenchRoofStatus = {
  form: HouseFormRoofIntentModel["form"];
  roofIntentAuthored: boolean;
  rawForm: HouseFormRoofIntentModel["form"];
  resolvedForm: HouseFormRoofIntentModel["form"];
  resolutionSource: string;
  repairCode: string | null;
  controls: ReturnType<typeof getHouseRoofFormBehavior>["controls"];
  selectedFormSupported: boolean;
  terminalEnds: Array<{
    id: string;
    label: string;
    isOpen: boolean;
  }>;
  geometryKind: string | null;
  validationStatus: "valid" | "approximate" | "invalid" | null;
  validationCode: string | null;
  validationMessage: string | null;
  approximationReasons: string[];
  /**
   * PR-HR2 (2026-06-18): full per-stage diagnostics snapshot from
   * `@sp/geometry`. Carries the data the inspector rail's "Copy
   * diagnostics" button packages for bug reports. Always present
   * (empty defaults when there's no solved model) so consumers don't
   * have to null-guard every field.
   */
  stageDiagnostics: HouseRoofStageDiagnostics;
  /**
   * PR-HR2 (2026-06-18): which pipeline stage first reported a
   * failure, with the raw code. `null` when the roof is valid or only
   * approximate (no hard failure). Designers don't need to interpret
   * codes — the inspector rail uses this for a structured failure
   * panel.
   */
  failingStage: ObjectWorkbenchRoofFailingStage | null;
  provenance: ObjectWorkbenchRoofProvenance;
};

export type ObjectWorkbenchRoofCompatibilityStatus = ObjectWorkbenchRoofStatus;

export type ObjectWorkbenchHouseFormStatus = {
  lowConfidence: boolean;
  warnings: ObjectWorkbenchMigrationWarning[];
  footprintPreset: string | null;
  roofForm: string | null;
  defaultDeckHostEdgeId: AttachmentSide;
  attachmentZoneBlockedSummary: string;
  roof: ObjectWorkbenchRoofStatus | null;
};

export type ObjectWorkbenchDeckStatus = {
  validation: {
    status: "valid" | "invalid";
    codes: string[];
    messages: string[];
    message: string | null;
  };
  supportWarnings: {
    codes: string[];
    messages: string[];
  };
  interaction: DeckInteractionCapability;
};

export type ObjectWorkbenchOpeningStatus = {
  validation: {
    status: "valid" | "invalid";
    codes: string[];
    message: string | null;
  };
};

export type ObjectWorkbenchPergolaConnectionKind =
  | "freestanding"
  | "soffit"
  | "fascia"
  | "wall";

export type ObjectWorkbenchPergolaAttachmentStrategy =
  | CalculatorHouseAttachmentStrategy
  | "auto";

export type ObjectWorkbenchPergolaStatus = {
  connectionKind: ObjectWorkbenchPergolaConnectionKind;
  attachmentStrategy: ObjectWorkbenchPergolaAttachmentStrategy;
  confidence: "high" | "low";
  isFreestanding: boolean;
  resolution: {
    status: "resolved" | "unresolved" | "ambiguous";
    message: string | null;
  };
};

export type ObjectWorkbenchStatusFacade = {
  houseFormsById: Record<string, ObjectWorkbenchHouseFormStatus>;
  selectedHouseFormId: string | null;
  selectedHouseFormStatus: ObjectWorkbenchHouseFormStatus | null;
  houseForm: ObjectWorkbenchHouseFormStatus | null;
  deckStatuses: Record<string, ObjectWorkbenchDeckStatus>;
  openingStatuses: Record<string, ObjectWorkbenchOpeningStatus>;
  pergolaStatuses: Record<string, ObjectWorkbenchPergolaStatus>;
  activeDeckSupport: WorkbenchDeckSupportDiagnostic | null;
  activeDeckInteraction: DeckInteractionCapability | null;
  deckSupportWarningCount: number;
};

function isAttachmentSide(
  value: string | null | undefined,
): value is AttachmentSide {
  return ATTACHMENT_SIDES.includes(value as AttachmentSide);
}

function parseFiniteNumber(
  value: string | number | null | undefined,
  fallback: number,
): number {
  const parsed =
    typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function localPolygonToGeometryPolygon(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): Polygon3 {
  return polygon.map((point) => ({
    x: Number(point.alongM) * 1000,
    y: Number(point.depthM) * 1000,
    z: 0,
  }));
}

function geometryPolygonToSideLocalPolygon(
  polygon: Polygon3,
): CalculatorHouseFootprintPolygonPoint[] {
  return polygon.map((point) => ({
    alongM: String(point.x / 1000),
    depthM: String(Math.abs(point.y) / 1000),
  }));
}

function isOrthogonal2D(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): boolean {
  if (polygon.length < 4) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const alongStart = Number(start.alongM);
    const alongEnd = Number(end.alongM);
    const depthStart = Number(start.depthM);
    const depthEnd = Number(end.depthM);
    if (
      !Number.isFinite(alongStart) ||
      !Number.isFinite(alongEnd) ||
      !Number.isFinite(depthStart) ||
      !Number.isFinite(depthEnd)
    ) {
      return false;
    }
    if (
      Math.abs(alongStart - alongEnd) > 1e-6 &&
      Math.abs(depthStart - depthEnd) > 1e-6
    ) {
      return false;
    }
  }
  return true;
}

function resolveBoundingFootprintSpans(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): { alongM: number; depthM: number } | null {
  if (!polygon.length) return null;
  const alongValues = polygon.map((point) => Number(point.alongM));
  const depthValues = polygon.map((point) => Number(point.depthM));
  if (
    alongValues.some((value) => !Number.isFinite(value)) ||
    depthValues.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }
  return {
    alongM: Math.max(...alongValues) - Math.min(...alongValues),
    depthM: Math.max(...depthValues) - Math.min(...depthValues),
  };
}

function isRectanglePolygon2D(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): boolean {
  if (polygon.length !== 4 || !isOrthogonal2D(polygon)) return false;
  const alongValues = polygon.map((point) => Number(point.alongM));
  const depthValues = polygon.map((point) => Number(point.depthM));
  return (
    new Set(alongValues.map((value) => value.toFixed(6))).size === 2 &&
    new Set(depthValues.map((value) => value.toFixed(6))).size === 2
  );
}

function resolveRectangularFootprintSpans(
  polygon: CalculatorHouseFootprintPolygonPoint[],
): { alongM: number; depthM: number } | null {
  if (!isRectanglePolygon2D(polygon)) return null;
  return resolveBoundingFootprintSpans(polygon);
}

function resolvePreferredRidgeAxis(input: {
  footprint: Polygon3;
  polygon: CalculatorHouseFootprintPolygonPoint[];
  fallback: HouseFormRoofIntentModel["ridgeAxis"];
}): HouseFormRoofIntentModel["ridgeAxis"] {
  const rectangularSpans = resolveRectangularFootprintSpans(input.polygon);
  if (rectangularSpans) {
    return rectangularSpans.alongM >= rectangularSpans.depthM ? "x" : "y";
  }

  if (isOrthogonal2D(input.polygon)) {
    const xScore = deriveHouseGableTerminalEnds({
      footprint: input.footprint,
      ridgeAxis: "x",
    }).length;
    const yScore = deriveHouseGableTerminalEnds({
      footprint: input.footprint,
      ridgeAxis: "y",
    }).length;
    if (xScore > yScore) return "x";
    if (yScore > xScore) return "y";
  }

  const spans = resolveBoundingFootprintSpans(input.polygon);
  if (spans) {
    if (spans.alongM > spans.depthM * 1.05) return "x";
    if (spans.depthM > spans.alongM * 1.05) return "y";
  }
  return input.fallback;
}

function buildMigrationWarnings(
  warnings: string[],
): ObjectWorkbenchMigrationWarning[] {
  return warnings
    .map((warning) => warning.trim())
    .filter((warning) => warning.length > 0)
    .map((warning, index) => ({
      id: `legacy-estimate-warning-${index + 1}`,
      code: "legacy_estimate_snapshot_warning",
      field: "legacy_estimate_snapshot",
      message: warning,
      severity: "blocking",
    }));
}

/**
 * PR-HR2 (2026-06-18): derive a designer-readable failing stage from
 * the raw stage diagnostics. Mirrors the ordering of
 * `firstHouseRoofStageDiagnosticCode` in @sp/geometry; updating that
 * function's ordering should update this one. Returns `null` when no
 * stage reported a failure.
 */
function resolveFailingStage(
  diagnostics: HouseRoofStageDiagnostics,
): ObjectWorkbenchRoofFailingStage | null {
  const code = firstHouseRoofStageDiagnosticCode(diagnostics);
  if (!code) return null;
  if (diagnostics.footprintNormalizationStatus === "failed") {
    return { id: "footprint_normalization", label: "Footprint normalization", code };
  }
  if (diagnostics.eavePolygonConstructionStatus === "failed") {
    return { id: "eave_polygon_construction", label: "Eave polygon construction", code };
  }
  if (diagnostics.eaveOffsetTopologyStatus === "invalid") {
    return { id: "eave_polygon_construction", label: "Eave offset topology", code };
  }
  if (diagnostics.roofIntentNormalizationStatus === "failed") {
    return { id: "roof_intent_normalization", label: "Roof intent normalization", code };
  }
  if (diagnostics.roofEaveOffsetRepairCode) {
    return { id: "eave_offset_repair", label: "Eave offset repair", code };
  }
  if (diagnostics.roofTopologyCoverageFailureReason) {
    return { id: "roof_topology_coverage", label: "Roof topology coverage", code };
  }
  if (diagnostics.roofTopologyFailureReason) {
    return { id: "roof_topology_classification", label: "Roof topology classification", code };
  }
  if (diagnostics.roofWavefrontFailureReason) {
    return { id: "roof_wavefront", label: "Roof wavefront sweep", code };
  }
  if (diagnostics.roofTopologyClassificationStatus === "failed") {
    return { id: "roof_topology_classification", label: "Roof topology classification", code };
  }
  if (diagnostics.roofPlaneGenerationStatus === "failed") {
    return { id: "roof_plane_generation", label: "Roof plane generation", code };
  }
  return { id: "roof_qa_validation", label: "Roof QA validation", code };
}

function buildRoofProvenance(
  houseForm: HouseFormModel,
): ObjectWorkbenchRoofProvenance {
  if (!houseForm.roofIntentAuthored) {
    return {
      form: "legacy_pergola_inference",
      material: "legacy_shared_value",
      primaryPitchDeg: "legacy_shared_value",
      primaryFallDirection: "default_fallback",
      ridgeAxis: "default_fallback",
      openGableEndIds: "default_fallback",
    };
  }
  const source = "object_first_draft";
  return {
    form: source,
    material: source,
    primaryPitchDeg: source,
    primaryFallDirection: source,
    ridgeAxis: source,
    openGableEndIds: source,
  };
}

function buildRoofStatus(input: {
  derivedFootprintPolygon?: CalculatorHouseFootprintPolygonPoint[] | null;
  houseForm: HouseFormModel | null;
}): ObjectWorkbenchRoofStatus | null {
  const houseForm = input.houseForm;
  if (!houseForm) return null;
  const rawGeometry = buildHouseFormRawGeometryInput(houseForm);
  // PR-WB-COMPOSITION-ONLY (2026-06-19): polygon comes from
  // composition; the legacy `footprint.polygon` branch is gone.
  const roofFootprintPolygon =
    input.derivedFootprintPolygon && input.derivedFootprintPolygon.length > 0
      ? input.derivedFootprintPolygon
      : rawGeometry
        ? geometryPolygonToSideLocalPolygon(rawGeometry.footprint)
        : [];
  const intentResolution = resolveHouseFormRoofIntentForFootprint({
    houseForm,
  });
  const intent = intentResolution.roofIntent;
  const footprint = rawGeometry?.footprint ?? localPolygonToGeometryPolygon(roofFootprintPolygon);
  const capabilities = deriveHouseRoofCapabilities({
    roofForm: intent.form,
    footprint,
  });
  const geometryKind = deriveHouseRoofGeometryKind({
    roofForm: intent.form,
    footprint,
  });
  const terminalEnds = deriveHouseGableTerminalEnds({
    footprint,
    ridgeAxis: intent.ridgeAxis,
  });
  const preferredRidgeAxis =
    intent.form === "hipped"
      ? resolvePreferredRidgeAxis({
          footprint,
          polygon: roofFootprintPolygon,
          fallback: intent.ridgeAxis,
        })
      : null;
  const validation = validateHouseRoofSelection({
    roofForm: intent.form,
    footprint,
    roofPrimaryFallDirection: intent.primaryFallDirection,
    roofPrimaryFallDirectionExplicit: houseForm.roofIntentAuthored === true,
    preferredMonoFallDirection:
      intent.form === "mono"
        ? preferredMonoFallDirectionForAttachmentSide(
            houseForm.attachmentSide,
          )
        : null,
    enforcePreferredMonoFallDirection: false,
    roofRidgeAxis: intent.ridgeAxis,
    roofRidgeAxisExplicit: houseForm.roofIntentAuthored === true,
    preferredRidgeAxis,
  });
  const packageRoofModel = rawGeometry
    ? buildHouseModel3DFromRawHouseInput({
        rawHouse: rawGeometry.rawHouse,
        footprint: rawGeometry.footprint,
        pergolaAttachment: null,
      })
    : null;
  // PR-HR2 (2026-06-18): always summarize, even when there's no
  // package model — empty defaults mean consumers never have to
  // null-guard individual stage fields.
  const stageDiagnostics = packageRoofModel
    ? summarizeHouseModelRoofStageDiagnostics(packageRoofModel)
    : EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS;
  const packageRoofQaStatus =
    typeof packageRoofModel?.metadata?.roofQaStatus === "string"
      ? packageRoofModel.metadata.roofQaStatus
      : null;
  const packageRoofQaFailureReason =
    typeof packageRoofModel?.metadata?.roofQaFailureReason === "string"
      ? packageRoofModel.metadata.roofQaFailureReason
      : null;
  const packageRoofEaveOffsetRepairStatus =
    typeof packageRoofModel?.metadata?.roofEaveOffsetRepairStatus === "string"
      ? packageRoofModel.metadata.roofEaveOffsetRepairStatus
      : null;
  const packageRoofEaveOffsetRepairCode =
    typeof packageRoofModel?.metadata?.roofEaveOffsetRepairCode === "string"
      ? packageRoofModel.metadata.roofEaveOffsetRepairCode
      : null;
  const approximationReasons = [
    ...(houseForm.roofIntentAuthored ? [] : ["inferred_form"]),
    ...(packageRoofEaveOffsetRepairStatus === "repaired"
      ? ["eave_offset_repaired"]
      : []),
  ];
  const validationStatus =
    packageRoofQaStatus === "invalid"
      ? "invalid"
      : validation.status === "invalid"
      ? "invalid"
      : approximationReasons.length > 0
        ? "approximate"
        : "valid";
  const validationCode =
    packageRoofQaStatus === "invalid"
      ? (packageRoofEaveOffsetRepairCode ?? packageRoofQaFailureReason)
      : validation.code;
  const validationMessage =
    packageRoofQaStatus === "invalid"
      ? `Roof geometry failed package QA${
          validationCode ? `: ${validationCode}` : ""
        }.`
      : validation.message;

  return {
    form: intent.form,
    roofIntentAuthored: intentResolution.roofIntentAuthored,
    rawForm: intentResolution.rawForm,
    resolvedForm: intentResolution.resolvedForm,
    resolutionSource: intentResolution.source,
    repairCode: intentResolution.repairCode,
    controls: getHouseRoofFormBehavior(intent.form).controls,
    selectedFormSupported: capabilities.selectedFormSupported,
    terminalEnds: terminalEnds.map((end) => ({
      id: end.id,
      label: end.label,
      // Milestone 13 session C: `'gable'` was retired from
      // `HouseRoofForm`. The legacy slice-2 fallback (`form === 'gable'
      // ? true : ...`) is gone; every consumer reads explicit
      // openGableEndIds, which the workbench draft normalize boundary
      // populates when migrating from legacy gable.
      isOpen: intent.openGableEndIds.includes(end.id),
    })),
    geometryKind,
    validationStatus,
    validationCode,
    validationMessage,
    approximationReasons,
    stageDiagnostics,
    failingStage:
      validationStatus === "invalid" ? resolveFailingStage(stageDiagnostics) : null,
    provenance: buildRoofProvenance(houseForm),
  };
}

function buildDeckStatuses(
  decks: DeckObjectModel[],
): Record<string, ObjectWorkbenchDeckStatus> {
  return Object.fromEntries(
    decks.map((deck) => {
      const dragInteractionAvailable =
        deck.hostEdgeId === "rear" ||
        deck.hostEdgeId === "front" ||
        deck.hostEdgeId === "left" ||
        deck.hostEdgeId === "right";
      return [
        deck.id,
        {
          validation: {
            status: deck.validation?.status ?? "valid",
            codes: deck.validation?.codes ?? [],
            messages: deck.validation?.messages ?? [],
            message: deck.validation?.message ?? null,
          },
          supportWarnings: {
            codes: deck.supportContext?.warningCodes ?? [],
            messages: deck.supportContext?.warningMessages ?? [],
          },
          interaction: resolveDeckInteractionCapability({
            deck,
            dragInteractionAvailable,
          }),
        },
      ];
    }),
  );
}

function buildOpeningStatuses(
  openings: OpeningObjectModel[],
): Record<string, ObjectWorkbenchOpeningStatus> {
  return Object.fromEntries(
    openings.map((opening) => [
      opening.id,
      {
        validation: {
          status: opening.validation?.status ?? "valid",
          codes: opening.validation?.codes ?? [],
          message: opening.validation?.message ?? null,
        },
      },
    ]),
  );
}

function resolvePergolaConnectionKind(
  pergola: PergolaObjectModel,
): ObjectWorkbenchPergolaConnectionKind {
  // PR-F (2026-05-22): prefer the snap-derived attachment. Legacy
  // `connectionKind` / `strategy` fields stay as fallback until PR-H
  // deletes them.
  if (pergola.attachment)
    return connectionKindFromAttachment(pergola.attachment);
  if (pergola.connectionKind) return pergola.connectionKind;
  if (pergola.strategy === "none") return "freestanding";
  return "soffit";
}

function buildPergolaResolution(
  pergola: PergolaObjectModel,
  isFreestanding: boolean,
): ObjectWorkbenchPergolaStatus["resolution"] {
  if (isFreestanding) {
    return {
      status: "resolved",
      message: null,
    };
  }
  if (pergola.attachmentEdgeId || pergola.attachmentZoneId) {
    return {
      status: "resolved",
      message: null,
    };
  }
  return {
    status: "unresolved",
    message:
      "Select a resolved house edge or attachment zone for this pergola.",
  };
}

function buildPergolaStatuses(
  pergolas: PergolaObjectModel[],
): Record<string, ObjectWorkbenchPergolaStatus> {
  return Object.fromEntries(
    pergolas.map((pergola) => {
      const connectionKind = resolvePergolaConnectionKind(pergola);
      const isFreestanding = connectionKind === "freestanding";
      return [
        pergola.id,
        {
          connectionKind,
          attachmentStrategy: pergola.strategy ?? "auto",
          confidence: pergola.family === "unknown" ? "low" : "high",
          isFreestanding,
          resolution: buildPergolaResolution(pergola, isFreestanding),
        },
      ];
    }),
  );
}

function resolveAttachmentStrategyZoneKinds(
  strategy: HouseFormModel["attachmentStrategy"] | null | undefined,
): Array<"wall" | "soffit" | "fascia" | "roof_edge"> {
  switch (strategy) {
    case "facade_ledger":
    case "post_supported_tieback":
      return ["wall"];
    case "fascia_under_gutter":
      return ["fascia"];
    case "none":
      return [];
    case "soffit_brackets":
    default:
      return ["soffit"];
  }
}

function resolveOpeningAttachmentSide(
  projectModel: WorkbenchProjectModel,
  opening: OpeningObjectModel,
): AttachmentSide | null {
  if (isAttachmentSide(opening.wallId)) return opening.wallId;
  if (opening.hostEdgeId) {
    const zoneSide =
      projectModel.houseAssembly?.derivedEnvelope?.attachmentZones.find(
        (zone) => zone.hostEdgeId === opening.hostEdgeId,
      )?.side ?? null;
    if (isAttachmentSide(zoneSide)) return zoneSide;
  }
  return null;
}

function summarizeAttachmentZoneBlocks(
  projectModel: WorkbenchProjectModel,
  houseForm: HouseFormModel | null,
): string {
  const candidateKinds = resolveAttachmentStrategyZoneKinds(
    houseForm?.attachmentStrategy,
  );
  if (!candidateKinds.length) return "none";
  const houseFormId = houseForm?.id ?? null;

  const blocked = new Set<string>();
  for (const opening of projectModel.openings) {
    if (opening.kind !== "slider" && opening.kind !== "stacker") continue;
    if (
      houseFormId &&
      opening.sourceFormId &&
      opening.sourceFormId !== houseFormId
    )
      continue;
    const side = resolveOpeningAttachmentSide(projectModel, opening);
    if (!side) continue;
    for (const kind of candidateKinds) {
      if (kind === "soffit" || kind === "fascia" || kind === "roof_edge") {
        blocked.add(`${side} ${kind} (side_openings_block_roof_zone)`);
      }
    }
  }

  return blocked.size ? Array.from(blocked).join(" | ") : "none";
}

function buildHouseFormStatus(input: {
  derivedFootprintPolygon?: CalculatorHouseFootprintPolygonPoint[] | null;
  houseForm: HouseFormModel | null;
  projectModel: WorkbenchProjectModel;
  warnings: ObjectWorkbenchMigrationWarning[];
}): ObjectWorkbenchHouseFormStatus {
  const houseForm = input.houseForm;
  const roof = buildRoofStatus({
    derivedFootprintPolygon: input.derivedFootprintPolygon,
    houseForm,
  });
  return {
    lowConfidence: input.warnings.length > 0,
    warnings: input.warnings,
    footprintPreset: null,
    roofForm: roof?.form ?? null,
    defaultDeckHostEdgeId: houseForm?.attachmentSide ?? "rear",
    attachmentZoneBlockedSummary: summarizeAttachmentZoneBlocks(
      input.projectModel,
      houseForm,
    ),
    roof,
  };
}

export function buildObjectWorkbenchStatusFacade(input: {
  activeDeckId: string | null;
  activeHouseFormId?: string | null;
  projectModel: WorkbenchProjectModel;
}): ObjectWorkbenchStatusFacade {
  const houseForms = input.projectModel.houseAssembly?.houseForms ?? [];
  const activeHouseForm = input.activeHouseFormId
    ? (houseForms.find(
        (houseForm) => houseForm.id === input.activeHouseFormId,
      ) ?? null)
    : null;
  const warnings = buildMigrationWarnings(input.projectModel.warnings ?? []);
  const singleHouseDerivedFootprint =
    houseForms.length === 1
      ? (input.projectModel.houseAssembly?.derivedEnvelope?.footprint ?? null)
      : null;
  const houseFormsById = Object.fromEntries(
    houseForms.map((houseForm) => [
      houseForm.id,
      buildHouseFormStatus({
        derivedFootprintPolygon: singleHouseDerivedFootprint,
        houseForm,
        projectModel: input.projectModel,
        warnings,
      }),
    ]),
  );
  const activeHouseFormStatus = activeHouseForm
    ? (houseFormsById[activeHouseForm.id] ?? null)
    : null;
  const decks = input.projectModel.decks;
  const deckStatuses = buildDeckStatuses(decks);

  return {
    houseFormsById,
    selectedHouseFormId: activeHouseForm?.id ?? null,
    selectedHouseFormStatus: activeHouseFormStatus,
    houseForm: activeHouseFormStatus,
    deckStatuses,
    openingStatuses: buildOpeningStatuses(input.projectModel.openings),
    pergolaStatuses: buildPergolaStatuses(input.projectModel.pergolas),
    activeDeckSupport: null,
    activeDeckInteraction: input.activeDeckId
      ? (deckStatuses[input.activeDeckId]?.interaction ?? null)
      : null,
    deckSupportWarningCount: decks.reduce(
      (sum, deck) => sum + (deck.supportContext?.warningCodes.length ?? 0),
      0,
    ),
  };
}
