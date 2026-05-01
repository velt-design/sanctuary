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
import type { Assembly3D, AssemblyMember3D, QuantityHook, RoofPlane3D } from '@sp/geometry';
import { DEFAULT_CALCULATOR_ATTACHMENT_SIDE, normalizeAttachmentSide } from '@/lib/types/calculator';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
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

function mmToM(value: unknown): number | null {
  const mm = nonNegativeNumberOrNull(value);
  return mm == null ? null : mm / 1000;
}

function distanceMm(member: AssemblyMember3D): number {
  const dx = member.centerline.end.x - member.centerline.start.x;
  const dy = member.centerline.end.y - member.centerline.start.y;
  const dz = member.centerline.end.z - member.centerline.start.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function polygonAreaM2(boundary: RoofPlane3D['boundary']): number | null {
  if (!Array.isArray(boundary) || boundary.length < 3) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let index = 0; index < boundary.length; index += 1) {
    const current = boundary[index]!;
    const next = boundary[(index + 1) % boundary.length]!;
    x += current.y * next.z - current.z * next.y;
    y += current.z * next.x - current.x * next.z;
    z += current.x * next.y - current.y * next.x;
  }
  const areaMm2 = 0.5 * Math.sqrt(x * x + y * y + z * z);
  return Number.isFinite(areaMm2) ? areaMm2 / 1_000_000 : null;
}

function profileLabel(member: AssemblyMember3D | null | undefined): string | null {
  if (!member) return null;
  if (member.profile.profileKey) return member.profile.profileKey;
  return `${member.profile.depthMm}x${member.profile.widthMm}`;
}

function hooksByKey(hooks: QuantityHook[] | null | undefined): Map<string, QuantityHook> {
  return new Map((hooks ?? []).map((hook) => [hook.key, hook]));
}

function hookQuantity(hooks: Map<string, QuantityHook>, keys: string[]): number | null {
  for (const key of keys) {
    const quantity = nonNegativeNumberOrNull(hooks.get(key)?.quantity);
    if (quantity != null) return quantity;
  }
  return null;
}

function hookMmToM(hooks: Map<string, QuantityHook>, keys: string[]): number | null {
  return mmToM(hookQuantity(hooks, keys));
}

function sumMemberLengthM(assembly: Assembly3D | null | undefined, role: AssemblyMember3D['role']): number | null {
  const members = (assembly?.members ?? []).filter((member) => member.role === role);
  if (!members.length) return null;
  return members.reduce((sum, member) => sum + distanceMm(member), 0) / 1000;
}

function firstMember(assembly: Assembly3D | null | undefined, role: AssemblyMember3D['role']): AssemblyMember3D | null {
  return assembly?.members.find((member) => member.role === role) ?? null;
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
      ? distanceMm({
          id: 'attachment-edge',
          role: 'ledger',
          centerline: assembly.attachmentEdge,
          profile: { shape: 'rectangular', widthMm: 0, depthMm: 0 },
          localFrame: assembly.datum,
        })
        / 1000
      : null,
    warnings: diagnosticsForModule(module).map((diagnostic) => diagnostic.message),
  };
}

function buildRoofPlanes(assembly: Assembly3D | null): NonNullable<CommercialQuantityTakeoffV1['roofPlanes']> {
  return (assembly?.roofPlanes ?? []).map((plane, index) => ({
    id: plane.id || `roof-plane-${index + 1}`,
    label: typeof plane.metadata?.label === 'string' ? plane.metadata.label : undefined,
    areaM2: polygonAreaM2(plane.boundary),
    rafterLengthM: null,
    bayCount: null,
  }));
}

function buildQuantityTakeoff(module: WorkbenchSolvedModule): CommercialQuantityTakeoffV1 {
  const assembly = module.assembly;
  const hooks = hooksByKey(assembly?.quantityHooks);
  const primaryDimensions = assembly?.semantics.primaryDimensionsMm;
  const post = firstMember(assembly, 'post');
  const rafter = firstMember(assembly, 'rafter');
  const ledger = firstMember(assembly, 'ledger');
  const beam = firstMember(assembly, 'beam');
  const ridge = firstMember(assembly, 'ridge');
  const roofAreas = buildRoofPlanes(assembly).map((plane) => plane.areaM2 ?? 0);
  const roofAreaM2 = roofAreas.length ? roofAreas.reduce((sum, area) => sum + area, 0) : null;
  const flashingTotalM = sumFlashingRows(module.moduleInput);

  return {
    primaryDimensions: {
      lengthM: primaryDimensions ? primaryDimensions.length / 1000 : nonNegativeNumberOrNull(module.moduleInput.lengthM),
      projectionM: primaryDimensions ? primaryDimensions.projection / 1000 : nonNegativeNumberOrNull(module.moduleInput.projectionM),
      roofAreaM2,
    },
    roofPlanes: buildRoofPlanes(assembly),
    posts: {
      count: intOrNull(hookQuantity(hooks, ['posts.count']) ?? module.moduleInput.postCount),
      cutHeightM: hookMmToM(hooks, ['posts.total_length_mm']) && intOrNull(hookQuantity(hooks, ['posts.count']))
        ? (hookMmToM(hooks, ['posts.total_length_mm']) ?? 0) / (intOrNull(hookQuantity(hooks, ['posts.count'])) ?? 1)
        : nonNegativeNumberOrNull(module.moduleInput.postCutHeightM),
      profile: profileLabel(post),
    },
    rafters: {
      count: intOrNull(hookQuantity(hooks, ['rafters.count'])),
      spacingMm: null,
      cutLengthM: hookMmToM(hooks, ['rafters.total_length_mm']) && intOrNull(hookQuantity(hooks, ['rafters.count']))
        ? (hookMmToM(hooks, ['rafters.total_length_mm']) ?? 0) / (intOrNull(hookQuantity(hooks, ['rafters.count'])) ?? 1)
        : sumMemberLengthM(assembly, 'rafter'),
      profile: profileLabel(rafter),
    },
    beams: {
      ledgerLengthM: hookMmToM(hooks, ['ledger.length_mm']),
      frontBeamLengthM: hookMmToM(hooks, ['support_beam.length_mm', 'support_beams.total_length_mm', 'box_perimeter_beams.total_length_mm'])
        ?? sumMemberLengthM(assembly, 'beam'),
      ridgeLengthM: hookMmToM(hooks, ['ridge.length_mm']) ?? sumMemberLengthM(assembly, 'ridge'),
      tieBeamLengthM: hookMmToM(hooks, ['tie_beams.total_length_mm']),
      ledgerProfile: profileLabel(ledger),
      frontBeamProfile: profileLabel(beam),
      ridgeProfile: profileLabel(ridge),
    },
    gutters: {
      ourGutterLengthM: hookMmToM(hooks, ['outer_gutter.length_mm', 'gutter.length_mm', 'gutters.total_length_mm'])
        ?? sumMemberLengthM(assembly, 'gutter'),
      houseGutterLengthM: hookMmToM(hooks, ['house_gutter.length_mm']),
      downpipeCount: intOrNull(module.moduleInput.downpipeCount),
      downpipeJoinCount: intOrNull(module.moduleInput.downpipeJoinCount),
      downpipeElbowCount: intOrNull(module.moduleInput.downpipeElbowCount),
    },
    roofCladding: {
      acrylicAreaM2: assembly?.roofCladdingPanels.length ? roofAreaM2 : null,
      timberAreaM2: null,
      sheetCount: null,
      joinerRuns: intOrNull(hookQuantity(hooks, ['joiners.count'])),
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
