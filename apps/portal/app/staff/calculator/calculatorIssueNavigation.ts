import { CALCULATOR_CONFIGURATION_SECTIONS } from './calculatorConfigurationSections';

type CalculatorConfigurationSectionId = (typeof CALCULATOR_CONFIGURATION_SECTIONS)[number]['id'];

export type CalculatorIssue = {
  moduleIndex: number;
  moduleLabel: string;
  fieldId: string;
  sectionId: CalculatorConfigurationSectionId | null;
  label: string;
  message: string;
};

type CalculatorModuleErrors = Readonly<Record<string, string | null | undefined>>;

export function calculatorIssueSectionId(fieldId: string): CalculatorConfigurationSectionId | null {
  const section = CALCULATOR_CONFIGURATION_SECTIONS.find(({ fieldIds }) =>
    (fieldIds as readonly string[]).includes(fieldId),
  );
  return section?.id ?? null;
}

export function labelForCalculatorIssueField(id: string): string {
  switch (id) {
    case 'powdercoatStandardColour':
      return 'Powdercoat colour';
    case 'powdercoatCustomColour':
      return 'Custom powdercoat colour';
    case 'lengthM':
      return 'Roof Length (m)';
    case 'projectionM':
      return 'Roof Span (Eave‑to‑Eave) (m)';
    case 'hipCornerLengthBM':
      return 'Roof Length B (m)';
    case 'hipCornerProjectionBM':
      return 'Roof Span B (m)';
    case 'postCutHeightM':
      return 'Ledger underside height (m)';
    case 'roofPitchDeg':
      return 'Roof pitch (deg)';
    case 'downpipeCount':
      return 'Downpipes (count)';
    case 'downpipeJoinCount':
      return 'Downpipe joins';
    case 'downpipeElbowCount':
      return 'Downpipe elbows';
    case 'overhangEnabled':
      return 'Overhang';
    case 'overhangAmountM':
      return 'Overhang amount (m)';
    case 'overhangSupportBeamProfile':
      return 'Overhang support beam profile';
    case 'invertedEnabled':
      return 'Inverted roof';
    case 'invertedHouseGutter':
      return 'Inverted house gutter';
    case 'gableEndFramesMode':
      return 'Gable end frames';
    case 'gableHouseEdgeGutter':
      return 'House-side eave gutter';
    case 'gableOuterEdgeGutter':
      return 'Outer-side eave gutter';
    case 'postCount':
      return 'Post count';
    case 'fallDistanceMm':
      return 'Fall distance (mm)';
    case 'mixedAcrylicBaysMain':
      return 'Acrylic bays';
    case 'mixedAcrylicBaysA':
      return 'Acrylic bays (A)';
    case 'mixedAcrylicBaysB':
      return 'Acrylic bays (B)';
    case 'flashings':
      return 'Flashings';
    case 'timberRoofAboveType':
      return 'Timber roof above';
    case 'timberInsulatedPanelThicknessMm':
      return 'Insulated panel thickness (mm)';
    case 'timberTrayWidthMm':
      return 'Steel tray width (mm)';
    default:
      return id;
  }
}

export function buildCalculatorIssues({
  errorsByModule,
  moduleLabels,
}: {
  errorsByModule: readonly CalculatorModuleErrors[];
  moduleLabels: readonly (string | undefined)[];
}): CalculatorIssue[] {
  const out: CalculatorIssue[] = [];
  errorsByModule.forEach((map, moduleIndex) => {
    Object.entries(map).forEach(([fieldId, message]) => {
      if (!message) return;
      out.push({
        moduleIndex,
        moduleLabel: moduleLabels[moduleIndex] ?? `Module ${moduleIndex + 1}`,
        fieldId,
        sectionId: calculatorIssueSectionId(fieldId),
        label: labelForCalculatorIssueField(fieldId),
        message,
      });
    });
  });
  return out;
}
