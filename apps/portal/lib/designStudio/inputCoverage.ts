import type {
  BlindLineItem,
  CalculatorAdditionalAluminiumRow,
  CalculatorAdditionalAluminiumState,
  CalculatorBlindsState,
  CalculatorFlashingsState,
  CalculatorHouseFootprintParams,
  CalculatorHouseFootprintPolygonPoint,
  CalculatorInfillsState,
  CalculatorInputs,
  CalculatorLightingInput,
  CalculatorModuleInputs,
  CalculatorModuleOverrides,
  CalculatorPergola,
  CalculatorStandaloneInfillsState,
  InfillEdgeConfirmations,
  InfillLineItem,
  InfillSupportInput,
} from '@/lib/types/calculator';

/** Migration and navigation coverage only. Conditional visibility, defaults,
 * validation and pricing remain with their existing domain owners. This registry
 * is not an authored studio design contract or a workbench runtime adapter. */
export const studioInputSections = {
  context: { label: 'Project', scope: 'job' },
  shape: { label: 'Shape & size', scope: 'module' },
  roof: { label: 'Roof', scope: 'module' },
  finish: { label: 'Finish', scope: 'module' },
  connections: { label: 'Connections', scope: 'module' },
  drainage: { label: 'Drainage', scope: 'module' },
  structure: { label: 'Structure & custom', scope: 'module' },
  flashings: { label: 'Flashings', scope: 'module' },
  infills: { label: 'Infills', scope: 'module' },
  lighting: { label: 'Lighting', scope: 'pergola' },
  site: { label: 'Site', scope: 'job' },
  pricing: { label: 'Pricing', scope: 'job' },
  blinds: { label: 'Blinds', scope: 'job' },
  aluminium: { label: 'Additional aluminium', scope: 'job' },
  standaloneInfills: { label: 'Separate infills', scope: 'job' },
  composition: { label: 'Design objects', scope: 'job' },
} as const;

export type StudioInputSection = keyof typeof studioInputSections;
export type StudioInputScope = 'module' | 'pergola' | 'job';
export type StudioInputDisposition = 'editor' | 'identity' | 'container' | 'preserve-only';
export type StudioInputCoverage = {
  scope: StudioInputScope;
  section: StudioInputSection | null;
  disposition: StudioInputDisposition;
};
type Coverage<T> = { readonly [K in keyof T]-?: StudioInputCoverage };
const field = (
  scope: StudioInputScope,
  section: StudioInputSection | null,
  disposition: StudioInputDisposition = 'editor',
): StudioInputCoverage => ({ scope, section, disposition });
const moduleField = (section: StudioInputSection) => field('module', section);
const preservedModule = field('module', null, 'preserve-only');

export const calculatorJobInputCoverage = {
  schemaVersion: field('job', null, 'identity'),
  projectName: field('job', 'context'),
  quoteRef: field('job', 'context'),
  access: field('job', 'site'),
  height: field('job', 'site'),
  jobType: field('job', 'site'),
  pricingClassification: field('job', 'pricing'),
  approvalRequirement: field('job', 'pricing'),
  travelExGst: field('job', 'pricing'),
  extrasAllowanceExGst: field('job', 'pricing'),
  quoteDiscountPct: field('job', 'pricing'),
  pergolas: field('job', 'composition', 'container'),
  modules: field('job', 'composition', 'container'),
  blinds: field('job', 'blinds', 'container'),
  additionalAluminium: field('job', 'aluminium', 'container'),
  standaloneInfills: field('job', 'standaloneInfills', 'container'),
} satisfies Coverage<CalculatorInputs>;

export const calculatorModuleInputCoverage = {
  pergolaId: field('module', 'composition', 'identity'),
  pergolaStyle: moduleField('shape'),
  roofMaterial: moduleField('roof'),
  extrusionColour: moduleField('finish'),
  powdercoatStandardColour: moduleField('finish'),
  powdercoatIsCustom: moduleField('finish'),
  powdercoatCustomColour: moduleField('finish'),
  boxPerimeterEnabled: moduleField('shape'),
  internalRoofType: preservedModule,
  fallDistanceMm: preservedModule,
  roofPitchDeg: moduleField('roof'),
  rafterSpacingMm: moduleField('structure'),
  gableEndFramesMode: moduleField('structure'),
  gableHouseEdgeGutter: moduleField('drainage'),
  gableOuterEdgeGutter: moduleField('drainage'),
  boxGutterHouseEdge: moduleField('drainage'),
  boxGutterFarEdge: moduleField('drainage'),
  downpipeCount: moduleField('drainage'),
  downpipeJoinCount: moduleField('drainage'),
  downpipeElbowCount: moduleField('drainage'),
  separateGutterEnabled: moduleField('drainage'),
  overhangEnabled: moduleField('roof'),
  overhangAmountM: moduleField('roof'),
  overhangSupportBeamProfile: moduleField('structure'),
  invertedEnabled: moduleField('roof'),
  invertedHouseGutter: moduleField('drainage'),
  mixedSkylightStripCount: preservedModule,
  mixedSkylightStripWidthM: preservedModule,
  mixedAcrylicBaysMain: moduleField('roof'),
  mixedAcrylicBaysA: moduleField('roof'),
  mixedAcrylicBaysB: moduleField('roof'),
  ceilingOption: moduleField('roof'),
  timberRoofAboveType: moduleField('roof'),
  timberInsulatedPanelThicknessMm: moduleField('roof'),
  timberTrayWidthMm: moduleField('roof'),
  postCount: moduleField('structure'),
  houseConnectionType: moduleField('connections'),
  attachmentSide: preservedModule,
  drawingRotationQuarterTurns: preservedModule,
  houseFootprintMode: preservedModule,
  houseFootprintPreset: preservedModule,
  houseFootprintParams: preservedModule,
  houseFootprintPolygon: preservedModule,
  houseFootprintPosition: preservedModule,
  houseStoreyMode: preservedModule,
  houseAttachmentStrategy: preservedModule,
  houseEaveHeightM: preservedModule,
  houseWallHeightM: preservedModule,
  houseRoofPitchDeg: preservedModule,
  houseSoffitDepthMm: preservedModule,
  houseFasciaHeightMm: preservedModule,
  houseGutterWidthMm: preservedModule,
  houseGutterDepthMm: preservedModule,
  houseGutterProjectionMm: preservedModule,
  houseEaveOverhangMm: preservedModule,
  postConnectionType: moduleField('connections'),
  ground: moduleField('connections'),
  lengthM: moduleField('shape'),
  projectionM: moduleField('shape'),
  hipCornerLengthBM: moduleField('shape'),
  hipCornerProjectionBM: moduleField('shape'),
  postCutHeightM: moduleField('shape'),
  timberRoofAllowanceExGst: preservedModule,
  flashings: field('module', 'flashings', 'container'),
  additionalAluminium: preservedModule,
  overrides: field('module', 'structure', 'container'),
  infills: field('module', 'infills', 'container'),
} satisfies Coverage<CalculatorModuleInputs>;

export const calculatorPergolaInputCoverage = {
  id: field('pergola', 'composition', 'identity'),
  label: field('pergola', 'composition'),
  lighting: field('pergola', 'lighting', 'container'),
} satisfies Coverage<CalculatorPergola>;
export const calculatorLightingInputCoverage = {
  lightCount: field('pergola', 'lighting'),
  dimmer: field('pergola', 'lighting'),
} satisfies Coverage<CalculatorLightingInput>;
export const calculatorOverrideInputCoverage = {
  ledgerProfile: moduleField('structure'),
  rafterProfile: moduleField('structure'),
  postProfile: moduleField('structure'),
  frontBeamProfile: moduleField('structure'),
  ridgeBeamProfile: moduleField('structure'),
  boxPerimeterBeamProfile: moduleField('structure'),
  overhangSupportBeamProfile: preservedModule,
  tieBeamProfile: moduleField('structure'),
  strutProfile: moduleField('structure'),
} satisfies Coverage<CalculatorModuleOverrides>;
export const calculatorFlashingInputCoverage = {
  id: field('module', 'flashings', 'identity'),
  kind: field('module', 'flashings', 'identity'),
  band: moduleField('flashings'),
  lengthM: moduleField('flashings'),
  purpose: moduleField('flashings'),
} satisfies Coverage<CalculatorFlashingsState['rows'][number]>;
export const calculatorFlashingsInputCoverage = {
  rows: field('module', 'flashings', 'container'),
} satisfies Coverage<CalculatorFlashingsState>;
export const calculatorBlindsInputCoverage = {
  items: field('job', 'blinds', 'container'),
} satisfies Coverage<CalculatorBlindsState>;
export const calculatorBlindInputCoverage = {
  id: field('job', 'blinds', 'identity'),
  label: field('job', 'blinds'),
  system: field('job', 'blinds'),
  widthMm: field('job', 'blinds'),
  coverLengthMm: field('job', 'blinds'),
  fabric: field('job', 'blinds'),
  motorised: field('job', 'blinds'),
  rollCover: field('job', 'blinds'),
} satisfies Coverage<BlindLineItem>;
export const calculatorAluminiumInputCoverage = {
  rows: field('job', 'aluminium', 'container'),
  extrusionColour: field('job', 'aluminium'),
  powdercoatStandardColour: field('job', 'aluminium'),
  powdercoatIsCustom: field('job', 'aluminium'),
  powdercoatCustomColour: field('job', 'aluminium'),
} satisfies Coverage<CalculatorAdditionalAluminiumState>;
export const calculatorAluminiumRowInputCoverage = {
  id: field('job', 'aluminium', 'identity'),
  profile: field('job', 'aluminium'),
  stockLengthM: field('job', 'aluminium'),
  quantity: field('job', 'aluminium'),
} satisfies Coverage<CalculatorAdditionalAluminiumRow>;

// Infill children are reusable at two scopes. An explicit owner prevents a
// standalone infill from acquiring a fictitious module or roof dependency.
export function calculatorInfillCoverage(owner: 'module' | 'standalone') {
  const scope = owner === 'module' ? 'module' : 'job';
  const section = owner === 'module' ? 'infills' : 'standaloneInfills';
  const editable = field(scope, section);
  const preserve = field(scope, null, 'preserve-only');
  return {
    state: { items: field(scope, section, 'container') } satisfies Coverage<CalculatorInfillsState>,
    item: {
      id: field(scope, section, 'identity'), label: editable, qty: editable,
      location: editable, acrylicSource: editable, panelOrientation: editable,
      widthMode: preserve, targetPanelWidthM: preserve, maxPanelWidthM: preserve,
      support: field(scope, section, 'container'), shape: field(scope, section, 'container'),
    } satisfies Coverage<InfillLineItem>,
    support: {
      hasTop: preserve, hasBottom: preserve, hasLeft: preserve, hasRight: preserve,
      edgeConfirmations: field(scope, section, 'container'),
      internalSupportMode: editable, internalSupportPositionsM: editable,
    } satisfies Coverage<InfillSupportInput>,
    confirmations: { top: editable, bottom: editable, left: editable, right: editable } satisfies Coverage<InfillEdgeConfirmations>,
    rectangle: {
      type: editable, widthM: editable, heightM: editable, bottomOffsetM: editable,
    } satisfies Coverage<Extract<InfillLineItem['shape'], { type: 'rect' }>>,
    slope: {
      type: editable, widthM: editable, heightLowM: editable,
      heightHighM: editable, bottomOffsetM: editable, slopeMode: editable,
      slopeDeg: editable, slopeAnchor: editable,
    } satisfies Coverage<Extract<InfillLineItem['shape'], { type: 'mono_slope' }>>,
  };
}
export const calculatorStandaloneInfillsInputCoverage = {
  items: field('job', 'standaloneInfills', 'container'),
  extrusionColour: field('job', 'standaloneInfills'),
  powdercoatStandardColour: field('job', 'standaloneInfills'),
  powdercoatIsCustom: field('job', 'standaloneInfills'),
  powdercoatCustomColour: field('job', 'standaloneInfills'),
} satisfies Coverage<CalculatorStandaloneInfillsState>;

export const calculatorHouseParamsCoverage = {
  widthM: preservedModule, offsetXM: preservedModule, setbackM: preservedModule,
  bandDepthM: preservedModule, returnRunM: preservedModule, recessWidthM: preservedModule,
  recessDepthM: preservedModule, leftLegRunM: preservedModule, rightLegRunM: preservedModule,
  sideRunM: preservedModule,
} satisfies Coverage<CalculatorHouseFootprintParams>;
export const calculatorHousePointCoverage = {
  alongM: preservedModule, depthM: preservedModule,
} satisfies Coverage<CalculatorHouseFootprintPolygonPoint>;
export const calculatorHousePositionCoverage = {
  originXMm: preservedModule, originYMm: preservedModule, rotationDeg: preservedModule,
} satisfies Coverage<NonNullable<CalculatorModuleInputs['houseFootprintPosition']>>;
