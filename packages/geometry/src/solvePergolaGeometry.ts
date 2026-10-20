import type {
  Assembly3D,
  AttachmentSide,
  BoxGutterMode,
  ConnectionType,
  GableEaveGutterMode,
  GableEndFramesMode,
  GeometryConfig,
  GeometryPlanViewModel,
  GeometryQuantityTakeoff,
  GeometrySectionViewModel,
  GeometryTopProjectionViewModel,
  GeometryValidationReport,
  HouseAttachmentStrategy,
  RawGeometryModuleInput,
  RawGroundCondition,
  RawHouseInput,
  RawPergolaStyle,
  RawPostConnectionType,
  RawRoofMaterial,
  RawSlopeDirection,
  ViewerSceneModel,
} from './contracts';
import { normalizeGeometryConfig, type NormalizeGeometryConfigErrorCode } from './normalize';
import { buildPlanViewModel } from './plan';
import { buildSectionViewModel } from './section';
import { retainAttachedMonoRoofDatum } from './monoRoofDatumBasis';
import { solveAssembly3D } from './solve';
import type { SolveAssembly3DErrorCode } from './solve.types';
import { buildAssemblyQuantityTakeoff } from './takeoff';
import { buildTopProjectionViewModelFromScene } from './topProjection';
import { validateGeometrySolve } from './validate';
import { buildViewerSceneModel } from './viewer';

type PergolaGeometryFamily = GeometryConfig['family'] | 'unknown';

type PergolaGeometrySolveErrorCode =
  | NormalizeGeometryConfigErrorCode
  | SolveAssembly3DErrorCode
  | 'unsupported_family';

export type PergolaGeometryInput = {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  family: PergolaGeometryFamily;
  dimensions: {
    lengthM?: string | number | null;
    projectionM?: string | number | null;
    hipCornerLengthBM?: string | number | null;
    hipCornerProjectionBM?: string | number | null;
  };
  roof?: {
    material?: RawRoofMaterial | null;
    mode?: string | null;
    pitchDeg?: string | number | null;
    slopeDirection?: RawSlopeDirection | null;
    overhangEnabled?: boolean | null;
    overhangM?: string | number | null;
    boxPerimeterEnabled?: boolean | null;
    mixedAcrylicBaysMain?: string | number | null;
    mixedAcrylicBaysA?: string | number | null;
    mixedAcrylicBaysB?: string | number | null;
  } | null;
  gable?: {
    endFramesMode?: GableEndFramesMode | null;
    houseEaveGutterMode?: GableEaveGutterMode | null;
    outerEaveGutterMode?: GableEaveGutterMode | null;
  } | null;
  box?: {
    houseEdgeGutterMode?: BoxGutterMode | null;
    farEdgeGutterMode?: BoxGutterMode | null;
  } | null;
  connection: {
    type: ConnectionType;
    attachmentSide?: AttachmentSide | null;
    attachmentStrategy?: HouseAttachmentStrategy | null;
  };
  position?: {
    origin: { x: string | number; y: string | number };
    rotationDeg?: string | number | null;
  } | null;
  supports?: {
    postCount?: string | number | null;
    postCutHeightM?: string | number | null;
    postConnectionType?: RawPostConnectionType | null;
    ground?: RawGroundCondition | null;
  } | null;
  structural?: {
    heights?: {
      houseUndersideM?: string | number | null;
      outerUndersideM?: string | number | null;
      referenceUndersideM?: string | number | null;
    } | null;
    profiles?: {
      post?: string | null;
      rafter?: string | null;
      ledger?: string | null;
      supportBeam?: string | null;
      gutter?: string | null;
      ridge?: string | null;
      tieBeam?: string | null;
      strut?: string | null;
      boxPerimeter?: string | null;
    } | null;
    framing?: {
      rafterCount?: string | number | null;
      rafterSpacingMm?: string | number | null;
      widthReference?: 'outside_faces';
    } | null;
    drainage?: {
      gutterType?: string | null;
      gutterAssemblyMode?: GeometryConfig['structural']['drainage']['gutterAssemblyMode'];
      integratedGutterBeam?: boolean | null;
      hasOurGutter?: boolean | null;
    } | null;
  } | null;
  hostHouse?: RawHouseInput | null;
};

type PergolaGeometrySolveSuccess = {
  ok: true;
  config: GeometryConfig;
  assembly: Assembly3D;
  validation: GeometryValidationReport;
  viewerScene: ViewerSceneModel;
  topProjection: GeometryTopProjectionViewModel;
  plan: GeometryPlanViewModel;
  section: GeometrySectionViewModel;
  quantityTakeoff: GeometryQuantityTakeoff;
};

type PergolaGeometrySolveFailure = {
  ok: false;
  code: PergolaGeometrySolveErrorCode;
  error: string;
};

type PergolaGeometrySolveResult =
  | PergolaGeometrySolveSuccess
  | PergolaGeometrySolveFailure;

const EMPTY_RAW_HOUSE: RawHouseInput = {
  houseId: 'host-house',
  footprintMode: 'preset',
  footprintPreset: 'straight',
  footprintParams: null,
  footprintPolygon: null,
  position: null,
  storeyMode: 'single_storey',
  wallConstruction: 'timber_frame',
  roofForm: 'hipped',
  roofPrimaryFallDirection: 'positive_y',
  roofRidgeAxis: 'x',
  openGableEndIds: [],
  decks: [],
  openings: [],
  attachmentStrategy: null,
};

const DEFAULT_STRUCTURAL_INPUT: NonNullable<PergolaGeometryInput['structural']> = {
  heights: {
    houseUndersideM: 2.4,
    outerUndersideM: 2.137,
    referenceUndersideM: 2.4,
  },
  profiles: {
    post: '90x90',
    rafter: '150x50',
    ledger: '100x50',
    supportBeam: '150x50',
    gutter: 'SP Gutter',
    ridge: '150x50',
    tieBeam: null,
    strut: null,
    boxPerimeter: '300x50',
  },
  framing: {
    rafterCount: 11,
    rafterSpacingMm: 600,
  },
  drainage: {
    gutterType: 'sp_gutter',
    gutterAssemblyMode: 'integrated',
    integratedGutterBeam: true,
    hasOurGutter: true,
  },
};

function defaultStructuralInputForFamily(
  family: PergolaGeometryFamily,
): NonNullable<PergolaGeometryInput['structural']> {
  if (family === 'box') {
    return {
      ...DEFAULT_STRUCTURAL_INPUT,
      heights: {
        houseUndersideM: 2.5,
        outerUndersideM: 2.5,
        referenceUndersideM: 2.5,
      },
      profiles: {
        ...DEFAULT_STRUCTURAL_INPUT.profiles,
        rafter: '80x50',
        gutter: '100x100',
      },
      framing: {
        rafterCount: 10,
        rafterSpacingMm: 550,
      },
    };
  }
  if (family === 'gable' || family === 'hip') {
    return {
      ...DEFAULT_STRUCTURAL_INPUT,
      heights: {
        ...DEFAULT_STRUCTURAL_INPUT.heights,
        outerUndersideM: DEFAULT_STRUCTURAL_INPUT.heights?.referenceUndersideM ?? 2.4,
      },
      profiles: {
        ...DEFAULT_STRUCTURAL_INPUT.profiles,
        tieBeam: '150x50',
        strut: '90x45',
      },
    };
  }
  return DEFAULT_STRUCTURAL_INPUT;
}

function parsePositiveNumber(value: string | number | null | undefined): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function withoutEmptyOverrides<T extends Record<string, unknown>>(input: T | null | undefined): Partial<T> {
  if (!input) return {};
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<T>;
}

function derivedBoxInput(input: PergolaGeometryInput): RawGeometryModuleInput['derived'] | undefined {
  if (input.family !== 'box') return undefined;
  const projectionM = parsePositiveNumber(input.dimensions.projectionM);
  const pitchDeg = parsePositiveNumber(input.roof?.pitchDeg);
  if (projectionM === null || pitchDeg === null) return undefined;
  const effectiveRunM = Math.max(projectionM - 0.2, 0);
  const riseMm = Math.round(effectiveRunM * 1000 * Math.tan((pitchDeg * Math.PI) / 180));
  return {
    boxEffectiveRunM: effectiveRunM,
    boxRiseMm: Math.max(riseMm, 1),
    boxMaxFallMm: Math.max(Math.min(riseMm, 120), 1),
  };
}

function rawPergolaStyleForFamily(family: PergolaGeometryFamily): RawPergolaStyle | null {
  if (family === 'mono' || family === 'box') return 'pitched';
  if (family === 'gable') return 'gable';
  if (family === 'hip') return 'hip';
  if (family === 'hip_corner') return 'hip_corner';
  return null;
}

function rawConnectionType(connectionType: ConnectionType): RawGeometryModuleInput['connection']['houseConnectionType'] {
  if (connectionType === 'freestanding') return 'freestanding';
  if (connectionType === 'wall') return 'wall';
  if (connectionType === 'fascia') return 'fascia';
  return 'soffit';
}

function rawPergolaInputFromGeometryInput(input: PergolaGeometryInput): RawGeometryModuleInput | null {
  const pergolaStyle = rawPergolaStyleForFamily(input.family);
  if (!pergolaStyle) return null;
  const rawHouse = input.hostHouse ?? EMPTY_RAW_HOUSE;
  const structural = input.structural ?? {};
  const structuralDefaults = defaultStructuralInputForFamily(input.family);
  return {
    projectId: input.projectId,
    estimateId: input.estimateId,
    designRequestId: input.designRequestId ?? null,
    pergolaStyle,
    boxPerimeterEnabled: input.family === 'box' || input.roof?.boxPerimeterEnabled === true,
    roof: {
      material: input.roof?.material ?? 'acrylic',
      mode: input.roof?.mode ?? null,
      slopeDirection: input.roof?.slopeDirection ?? 'away_from_house',
      roofPitchDeg: input.roof?.pitchDeg ?? null,
      overhangEnabled: input.roof?.overhangEnabled ?? false,
      overhangM: input.roof?.overhangM ?? null,
      mixedAcrylicBaysMain: input.roof?.mixedAcrylicBaysMain ?? null,
      mixedAcrylicBaysA: input.roof?.mixedAcrylicBaysA ?? null,
      mixedAcrylicBaysB: input.roof?.mixedAcrylicBaysB ?? null,
    },
    gable: {
      endFramesMode: input.gable?.endFramesMode ?? null,
      houseEaveGutter: input.gable?.houseEaveGutterMode ?? null,
      outerEaveGutter: input.gable?.outerEaveGutterMode ?? null,
    },
    box: {
      houseEdgeGutter: input.box?.houseEdgeGutterMode ?? null,
      farEdgeGutter: input.box?.farEdgeGutterMode ?? null,
    },
    connection: {
      houseConnectionType: rawConnectionType(input.connection.type),
      attachmentSide: input.connection.attachmentSide ?? 'rear',
    },
    position: input.position ?? null,
    supports: {
      postCount: input.supports?.postCount ?? (input.connection.type === 'freestanding' ? 4 : 2),
      postCutHeightM: input.supports?.postCutHeightM ?? 2.4,
      postConnectionType: input.supports?.postConnectionType ?? 'slab_anchors',
      ground: input.supports?.ground ?? 'easy',
    },
    structural: {
      heights: {
        ...structuralDefaults.heights,
        ...withoutEmptyOverrides(structural.heights),
      },
      profiles: {
        ...structuralDefaults.profiles,
        ...withoutEmptyOverrides(structural.profiles),
      },
      framing: {
        ...structuralDefaults.framing,
        ...withoutEmptyOverrides(structural.framing),
      },
      drainage: {
        ...structuralDefaults.drainage,
        ...withoutEmptyOverrides(structural.drainage),
      },
    },
    houseContext: {
      ...rawHouse,
      attachmentStrategy: input.connection.attachmentStrategy ?? rawHouse.attachmentStrategy ?? null,
    },
    dimensions: input.dimensions,
    derived: derivedBoxInput(input),
  };
}

export function solvePergolaGeometry(input: PergolaGeometryInput, options?: {supportDatumMm?: number; roofDatumBasis?: 'attached'}): PergolaGeometrySolveResult {
  const rawInput = rawPergolaInputFromGeometryInput(input);
  if (!rawInput) {
    return {
      ok: false,
      code: 'unsupported_family',
      error: `Pergola family ${input.family} is not supported by Sanctuary geometry V1.`,
    };
  }

  const normalize = normalizeGeometryConfig(rawInput);
  if (!normalize.ok) {
    return {
      ok: false,
      code: normalize.code,
      error: normalize.error,
    };
  }

  let config = normalize.value;
  if (options?.supportDatumMm !== undefined) {
    const requested = options.supportDatumMm, nominal = normalize.value.supports.postCutHeightMm;
    if (!Number.isFinite(requested) || requested <= 0 || nominal == null || !Number.isFinite(nominal)) {
      return {ok:false,code:'insufficient_input',error:'An exact support datum requires a positive finite value and a resolved nominal post datum.'};
    }
    const delta = requested - nominal;
    if (delta !== 0) {
      const shift = (value: number | null) => value === null ? null : value + delta;
      config = {...config, supports:{...config.supports,postCutHeightMm:config.supports.postCutHeightMm==null?config.supports.postCutHeightMm:config.supports.postCutHeightMm+delta},
        structural:{...config.structural,heights:{
          houseUndersideMm:shift(config.structural.heights.houseUndersideMm),
          outerUndersideMm:shift(config.structural.heights.outerUndersideMm),
          referenceUndersideMm:shift(config.structural.heights.referenceUndersideMm),
        }}};
    }
  }
  if(options?.roofDatumBasis!==undefined){
    if(options.roofDatumBasis!=='attached')return {ok:false,code:'insufficient_input',error:'Unknown roof datum basis.'};
    const retained=retainAttachedMonoRoofDatum(config);
    if(!retained.ok)return retained;
    config=retained.config;
  }
  const solve = solveAssembly3D(config);
  // Exact concept datums can leave sub-millimetre post lengths. Reconcile the
  // aggregate hook from actual centreline lengths, as validation already does;
  // summing individually rounded posts accumulates an artificial discrepancy.
  if (solve.ok && options?.supportDatumMm !== undefined && !Number.isInteger(options.supportDatumMm)) {
    const total = Math.round(solve.value.members.filter(member => member.role === 'post').reduce((sum, member) => sum + Math.hypot(
      member.centerline.end.x-member.centerline.start.x,
      member.centerline.end.y-member.centerline.start.y,
      member.centerline.end.z-member.centerline.start.z), 0));
    solve.value.quantityHooks = solve.value.quantityHooks.map(hook => hook.key === 'posts.total_length_mm' ? {...hook, quantity:total} : hook);
  }

  const validation = validateGeometrySolve({
    config: normalize.value,
    solveResult: solve,
  });
  if (!solve.ok) {
    return {
      ok: false,
      code: solve.code,
      error: solve.error,
    };
  }

  const viewerScene = buildViewerSceneModel(solve.value);
  const topProjection = buildTopProjectionViewModelFromScene(viewerScene, {
    terminalEndAssembly: solve.value,
  });

  return {
    ok: true,
    config: normalize.value,
    assembly: solve.value,
    validation,
    viewerScene,
    topProjection,
    plan: buildPlanViewModel(solve.value),
    section: buildSectionViewModel(solve.value),
    quantityTakeoff: buildAssemblyQuantityTakeoff(solve.value),
  };
}
