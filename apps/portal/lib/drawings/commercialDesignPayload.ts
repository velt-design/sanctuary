import {
  COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1,
  type CommercialDesignInputV1,
  type CommercialDiagnosticV1,
  type CommercialModuleInputV1,
  type CommercialPergolaInputV1,
  type CommercialQuantityTakeoffV1,
  type CommercialSiteCommercialV1,
  type CommercialSolvedGeometryV1,
  type CommercialTrustStatusV1,
  type RoofType,
} from '@sp/costing';
import type { Assembly3D, AssemblyMemberProfile, GeometryQuantityTakeoff } from '@sp/geometry';
import { DEFAULT_CALCULATOR_ATTACHMENT_SIDE, normalizeAttachmentSide } from '@/lib/types/calculator';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type {
  WorkbenchSolvedModel,
  WorkbenchSolvedModule,
  WorkbenchTrustStatus,
  WorkbenchTrustStatusKind,
} from './state/workbenchSolvedModel';

type BuildCommercialDesignInputArgs = {
  solvedModel: WorkbenchSolvedModel;
  siteCommercial: CommercialSiteCommercialV1;
  diagnostics?: CommercialDiagnosticV1[];
};

type BuildCommercialModuleInputArgs = {
  module: WorkbenchSolvedModule;
};

type PergolaGroup = {
  id: string;
  label: string;
  modules: CommercialModuleInputV1[];
  diagnostics: CommercialDiagnosticV1[];
};

const SOURCE = 'workbench_solved' as const;

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function numberOrNull(value: unknown): number | null {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeNumberOrNull(value: unknown): number | null {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function intOrNull(value: unknown): number | null {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function lineLengthM(line: NonNullable<Assembly3D['attachmentEdge']>): number {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const dz = line.end.z - line.start.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) / 1000;
}

function profileLabel(profile: AssemblyMemberProfile | null | undefined): string | null {
  if (!profile) return null;
  if (profile.profileKey) return profile.profileKey;
  return `${profile.depthMm}x${profile.widthMm}`;
}

function trustStatusForModule(module: WorkbenchSolvedModule): CommercialTrustStatusV1 {
  if (module.trust.status === 'invalid_geometry' || module.trust.status === 'unresolved_host') return 'blocked';
  if (module.trust.status === 'legacy_unsupported_family') return 'unsupported';
  if (module.trust.status === 'geometry_ready' && module.assembly && module.trust.issues.length === 0) return 'ready';
  return 'approximate';
}

function trustStatusForPergola(modules: CommercialModuleInputV1[]): CommercialTrustStatusV1 {
  if (!modules.length) return 'blocked';
  if (modules.every((module) => module.trustStatus === 'ready')) return 'ready';
  if (modules.every((module) => module.trustStatus === 'blocked' || module.trustStatus === 'unsupported')) return 'blocked';
  return 'approximate';
}

function trustStatusForDesign(pergolas: CommercialPergolaInputV1[]): CommercialTrustStatusV1 {
  const modules = pergolas.flatMap((pergola) => pergola.modules);
  if (!modules.length) return 'blocked';
  if (modules.every((module) => module.trustStatus === 'ready')) return 'ready';
  if (modules.every((module) => module.trustStatus === 'blocked' || module.trustStatus === 'unsupported')) return 'blocked';
  return 'approximate';
}

function diagnosticForTrustIssue(issue: WorkbenchTrustStatusKind, trust: WorkbenchTrustStatus): CommercialDiagnosticV1 {
  const severity = issue === 'invalid_geometry' || issue === 'unresolved_host' ? 'blocking' : 'warning';
  return {
    code: `workbench_${issue}`,
    message: trust.status === issue && trust.message ? trust.message : `Workbench geometry trust issue: ${issue}.`,
    severity,
  };
}

function diagnosticsForModule(module: WorkbenchSolvedModule): CommercialDiagnosticV1[] {
  const issueSet = new Set<WorkbenchTrustStatusKind>([module.trust.status, ...module.trust.issues]);
  issueSet.delete('geometry_ready');
  const diagnostics = Array.from(issueSet).map((issue) => diagnosticForTrustIssue(issue, module.trust));
  if (!module.assembly) {
    diagnostics.push({
      code: 'workbench_assembly_missing',
      message: module.trust.message ?? 'Workbench solved module does not include a ready geometry assembly.',
      severity: module.trust.status === 'legacy_unsupported_family' ? 'warning' : 'blocking',
    });
  }
  return diagnostics;
}

function effectiveRoofType(module: CalculatorModuleInputs, assembly: Assembly3D | null): RoofType {
  const family = assembly?.family;
  if (family === 'mono') return 'pitched';
  if (family === 'box') return 'pitched';
  if (family === 'gable' || family === 'hip' || family === 'hip_corner') return family;
  if (module.pergolaStyle === 'gable' || module.pergolaStyle === 'hip' || module.pergolaStyle === 'hip_corner') return module.pergolaStyle;
  return module.internalRoofType ?? 'pitched';
}

function sanitizeOverrides(overrides: CalculatorModuleInputs['overrides']): Record<string, string | null | undefined> | undefined {
  if (!overrides) return undefined;
  const entries = Object.entries(overrides).filter(([, value]) => value == null || typeof value === 'string');
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function sumFlashingRows(module: CalculatorModuleInputs): number | null {
  const rows = module.flashings?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const total = rows.reduce((sum, row) => {
    const length = nonNegativeNumberOrNull(row.lengthM);
    return length == null ? sum : sum + length;
  }, 0);
  return total > 0 ? total : null;
}

function buildSolvedGeometry(module: WorkbenchSolvedModule): CommercialSolvedGeometryV1 {
  const assembly = module.assembly;
  return {
    status: trustStatusForModule(module),
    geometrySource: SOURCE,
    primaryDimensionsM: assembly?.semantics.primaryDimensionsMm
      ? {
          length: assembly.semantics.primaryDimensionsMm.length / 1000,
          projection: assembly.semantics.primaryDimensionsMm.projection / 1000,
        }
      : {
          length: nonNegativeNumberOrNull(module.moduleInput.lengthM) ?? 0,
          projection: nonNegativeNumberOrNull(module.moduleInput.projectionM) ?? 0,
        },
    secondaryDimensionsM: assembly?.semantics.secondaryDimensionsMm
      ? {
          length: assembly.semantics.secondaryDimensionsMm.length / 1000,
          projection: assembly.semantics.secondaryDimensionsMm.projection / 1000,
        }
      : module.moduleInput.pergolaStyle === 'hip_corner'
        ? {
            length: nonNegativeNumberOrNull(module.moduleInput.hipCornerLengthBM) ?? 0,
            projection: nonNegativeNumberOrNull(module.moduleInput.hipCornerProjectionBM) ?? 0,
          }
        : null,
    roofPlaneCount: assembly ? assembly.roofPlanes.length : null,
    attachmentLengthM: assembly?.attachmentEdge
      ? lineLengthM(assembly.attachmentEdge)
      : null,
    warnings: diagnosticsForModule(module).map((diagnostic) => diagnostic.message),
  };
}

function buildRoofPlanes(takeoff: GeometryQuantityTakeoff | null): NonNullable<CommercialQuantityTakeoffV1['roofPlanes']> {
  return (takeoff?.roofPlanes.items ?? []).map((plane, index) => ({
    id: plane.id || `roof-plane-${index + 1}`,
    label: plane.label,
    areaM2: plane.areaM2,
    rafterLengthM: plane.rafterAverageLengthM,
    bayCount: Math.max(0, plane.rafterCount - 1),
  }));
}

function buildQuantityTakeoff(module: WorkbenchSolvedModule): CommercialQuantityTakeoffV1 {
  const takeoff = module.geometryArtifact?.quantityTakeoff ?? null;
  const posts = takeoff?.members.byRole.post ?? null;
  const rafters = takeoff?.members.byRole.rafter ?? null;
  const ledgers = takeoff?.members.byRole.ledger ?? null;
  const beams = takeoff?.members.byRole.beam ?? null;
  const ridges = takeoff?.members.byRole.ridge ?? null;
  const flashingTotalM = sumFlashingRows(module.moduleInput);

  return {
    primaryDimensions: {
      lengthM: takeoff?.primaryDimensionsM?.length ?? nonNegativeNumberOrNull(module.moduleInput.lengthM),
      projectionM: takeoff?.primaryDimensionsM?.projection ?? nonNegativeNumberOrNull(module.moduleInput.projectionM),
      roofAreaM2: takeoff?.roofPlanes.totalAreaM2 ?? null,
    },
    roofPlanes: buildRoofPlanes(takeoff),
    posts: {
      count: posts?.count ?? intOrNull(module.moduleInput.postCount),
      cutHeightM: posts?.averageLengthM ?? nonNegativeNumberOrNull(module.moduleInput.postCutHeightM),
      profile: profileLabel(posts?.firstProfile),
    },
    rafters: {
      count: rafters?.count ?? null,
      spacingMm: null,
      cutLengthM: rafters?.averageLengthM ?? null,
      profile: profileLabel(rafters?.firstProfile),
    },
    beams: {
      ledgerLengthM: takeoff?.beams.ledgerLengthM ?? null,
      frontBeamLengthM: takeoff?.beams.supportBeamLengthM ?? takeoff?.beams.totalBeamLengthM ?? null,
      ridgeLengthM: takeoff?.beams.ridgeLengthM ?? null,
      tieBeamLengthM: takeoff?.beams.tieBeamLengthM ?? null,
      ledgerProfile: profileLabel(ledgers?.firstProfile),
      frontBeamProfile: profileLabel(beams?.firstProfile),
      ridgeProfile: profileLabel(ridges?.firstProfile),
    },
    gutters: {
      ourGutterLengthM: takeoff?.gutters.ourGutterLengthM ?? null,
      houseGutterLengthM: takeoff?.gutters.houseGutterLengthM ?? null,
      downpipeCount: intOrNull(module.moduleInput.downpipeCount),
      downpipeJoinCount: intOrNull(module.moduleInput.downpipeJoinCount),
      downpipeElbowCount: intOrNull(module.moduleInput.downpipeElbowCount),
    },
    roofCladding: {
      acrylicAreaM2: takeoff?.roofCladding.acrylicAreaM2 ?? null,
      timberAreaM2: null,
      sheetCount: null,
      joinerRuns: takeoff?.joiners.count ?? null,
    },
    flashings: {
      totalLengthM: flashingTotalM,
      byBandM: flashingTotalM == null ? undefined : {},
    },
    infills: {
      itemCount: intOrNull(module.moduleInput.infills?.items?.length),
      sheetAreaM2: null,
      stripPanelCount: null,
    },
    blindsAndAccessories: {
      blindCount: 0,
      accessoryCount: 0,
      notes: [],
    },
  };
}

export function buildCommercialModuleInputFromWorkbenchSolvedModule(args: BuildCommercialModuleInputArgs): CommercialModuleInputV1 {
  const input = args.module.moduleInput;
  return {
    id: args.module.id,
    label: args.module.label,
    sourceModuleIndex: args.module.index,
    trustStatus: trustStatusForModule(args.module),
    designIntent: {
      pergolaStyle: input.pergolaStyle,
      roofMaterial: input.roofMaterial,
      extrusionColour: input.extrusionColour,
      roofType: effectiveRoofType(input, args.module.assembly),
      houseConnectionType: input.houseConnectionType,
      attachmentSide:
        input.houseConnectionType === 'none'
          ? DEFAULT_CALCULATOR_ATTACHMENT_SIDE
          : normalizeAttachmentSide(input.attachmentSide),
      postConnectionType: input.postConnectionType,
      ground: input.postConnectionType === 'pile_1m' || input.postConnectionType === 'pile_1_5m' ? input.ground : null,
      roofPitchDeg: numberOrNull(input.roofPitchDeg),
      dimensions: {
        lengthM: nonNegativeNumberOrNull(input.lengthM),
        projectionM: nonNegativeNumberOrNull(input.projectionM),
        secondaryLengthM: input.pergolaStyle === 'hip_corner' ? nonNegativeNumberOrNull(input.hipCornerLengthBM) : null,
        secondaryProjectionM: input.pergolaStyle === 'hip_corner' ? nonNegativeNumberOrNull(input.hipCornerProjectionBM) : null,
      },
      roofOptions: {
        boxPerimeterEnabled: input.boxPerimeterEnabled,
        gableEndFramesMode: input.gableEndFramesMode,
        mixedRoofMode: input.roofMaterial === 'mixed' ? 'acrylic_bays' : null,
        overhangEnabled: input.overhangEnabled,
        invertedEnabled: input.invertedEnabled,
      },
    },
    solvedGeometry: buildSolvedGeometry(args.module),
    quantityTakeoff: buildQuantityTakeoff(args.module),
    options: {
      flashings: input.flashings,
      infills: input.infills,
      overrides: sanitizeOverrides(input.overrides),
      powdercoat: {
        standardColour: input.powdercoatStandardColour?.trim() || null,
        isCustom: input.powdercoatIsCustom === true,
        customColour: input.powdercoatCustomColour?.trim() || null,
      },
    },
    diagnostics: diagnosticsForModule(args.module),
  };
}

function groupLabelFromProjectModel(model: WorkbenchSolvedModel, pergolaId: string, fallbackIndex: number): string {
  const projectPergola = model.projectModel.pergolas.find((pergola) => pergola.id === pergolaId);
  if (projectPergola?.label?.trim()) return projectPergola.label.trim();
  return `Pergola ${fallbackIndex + 1}`;
}

export function buildCommercialDesignInputFromWorkbenchSolvedModel(args: BuildCommercialDesignInputArgs): CommercialDesignInputV1 {
  const groups: PergolaGroup[] = [];
  const groupById = new Map<string, PergolaGroup>();

  const getGroup = (pergolaId: string): PergolaGroup => {
    const existing = groupById.get(pergolaId);
    if (existing) return existing;
    const group: PergolaGroup = {
      id: pergolaId,
      label: groupLabelFromProjectModel(args.solvedModel, pergolaId, groups.length),
      modules: [],
      diagnostics: [],
    };
    groups.push(group);
    groupById.set(pergolaId, group);
    return group;
  };

  for (const solvedModule of args.solvedModel.modules) {
    const pergolaId = typeof solvedModule.moduleInput.pergolaId === 'string' && solvedModule.moduleInput.pergolaId.trim()
      ? solvedModule.moduleInput.pergolaId.trim()
      : 'pergola-1';
    getGroup(pergolaId).modules.push(buildCommercialModuleInputFromWorkbenchSolvedModule({ module: solvedModule }));
  }

  const pergolas: CommercialPergolaInputV1[] = groups
    .filter((group) => group.modules.length > 0)
    .map((group) => ({
      id: group.id,
      label: group.label,
      trustStatus: trustStatusForPergola(group.modules),
      modules: group.modules,
      diagnostics: group.diagnostics,
    }));

  const diagnostics = [...(args.diagnostics ?? [])];
  if (args.solvedModel.trust.status !== 'geometry_ready') {
    diagnostics.push(diagnosticForTrustIssue(args.solvedModel.trust.status, args.solvedModel.trust));
  }

  return {
    schemaVersion: COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1,
    source: SOURCE,
    trustStatus: trustStatusForDesign(pergolas),
    identity: {
      projectId: args.solvedModel.geometryIdentity.projectId,
      estimateId: args.solvedModel.geometryIdentity.estimateId,
      designRequestId: args.solvedModel.geometryIdentity.designRequestId,
    },
    pergolas,
    siteCommercial: args.siteCommercial,
    diagnostics,
  };
}
