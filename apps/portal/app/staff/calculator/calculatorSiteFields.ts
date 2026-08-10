import type {
  CalculatorHouseFootprintParams,
  CalculatorInputs,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import {
  normalizeAttachmentSide,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
  supportsHouseFootprints,
} from '@/lib/types/calculator';
import type { CalculatorConfigurationField as FieldSchemaItem } from './calculatorConfigurationSections';
import { DP_ELBOW_OPTIONS, DP_JOIN_OPTIONS } from './calculatorConfigurationFieldOptions';
import type { CalculatorResolvedDefaultTexts } from './calculatorResolvedDefaults';

type CalculatorModuleFieldSetter = <K extends keyof CalculatorModuleInputs>(
  key: K,
  next: CalculatorModuleInputs[K],
) => void;

type CalculatorJobFieldSetter = <K extends Exclude<keyof CalculatorInputs, 'modules'>>(
  key: K,
  next: CalculatorInputs[K],
) => void;

type CalculatorHouseFootprintParamSetter = (
  key: keyof CalculatorHouseFootprintParams,
  value: string,
) => void;

export type CalculatorSiteFieldBuilderInput = {
  activeModule: CalculatorModuleInputs;
  activeDrawingRotationQuarterTurns: number;
  values: CalculatorInputs;
  errors: Partial<Record<keyof CalculatorModuleInputs, string>>;
  resolvedDefaults: CalculatorResolvedDefaultTexts;
  derivedBoxPitch: number | undefined;
  derivedBoxRiseMm: number | undefined;
  derivedBoxMaxFallMm: number | undefined;
  hasOurGutterUi: boolean;
  setModuleField: CalculatorModuleFieldSetter;
  setJobField: CalculatorJobFieldSetter;
  setHouseFootprintParam: CalculatorHouseFootprintParamSetter;
};

export function buildCalculatorSiteFields({
  activeModule,
  activeDrawingRotationQuarterTurns,
  values,
  errors,
  resolvedDefaults,
  derivedBoxPitch,
  derivedBoxRiseMm,
  derivedBoxMaxFallMm,
  hasOurGutterUi,
  setModuleField,
  setJobField,
  setHouseFootprintParam,
}: CalculatorSiteFieldBuilderInput): FieldSchemaItem[] {
  const activeAttachmentSide = normalizeAttachmentSide(activeModule.attachmentSide);
  const activeHouseFootprintPreset = normalizeHouseFootprintPreset(activeModule.houseFootprintPreset);
  const activeHouseFootprintParams = normalizeHouseFootprintParams(activeModule.houseFootprintParams);
  return [
    {
      id: 'pricingClassification',
      label: 'Pricing classification',
      type: 'select',
      value: values.pricingClassification ?? 'bespoke',
      onChange: (v) => setJobField('pricingClassification', v as CalculatorInputs['pricingClassification']),
      options: [
        { label: 'Simple', value: 'simple' },
        { label: 'Bespoke', value: 'bespoke' },
      ],
      helperText: values.pricingClassification === 'simple'
        ? 'Uses the published Simple range policy while the design remains eligible.'
        : 'Uses the full bespoke overhead policy.',
    },
    {
      id: 'approvalRequirement',
      label: 'Approvals',
      type: 'select',
      value: values.approvalRequirement ?? 'neither',
      onChange: (v) => setJobField('approvalRequirement', v as CalculatorInputs['approvalRequirement']),
      options: [
        { label: 'Neither', value: 'neither' },
        { label: 'Engineering required', value: 'engineering_required' },
        { label: 'Full building consent', value: 'full_building_consent' },
      ],
      helperText: 'Approval allowances already include markup, exclude GST, and are never discounted.',
    },
    {
      id: 'houseConnectionType',
      label: 'House connection',
      type: 'select',
      value: activeModule.houseConnectionType,
      onChange: (v) => setModuleField('houseConnectionType', v as CalculatorModuleInputs['houseConnectionType']),
      options: [
        { label: 'Soffit', value: 'soffit' },
        { label: 'Fascia', value: 'fascia' },
        { label: 'Facade', value: 'facade' },
        { label: 'None', value: 'none' },
      ],
    },
    ...(activeModule.houseConnectionType !== 'none' && supportsHouseFootprints(activeModule.pergolaStyle)
        ? [
          {
            id: 'attachmentSide',
            label: 'Attachment side',
            type: 'select',
            value: activeAttachmentSide,
            onChange: (v) => setModuleField('attachmentSide', v as CalculatorModuleInputs['attachmentSide']),
            options: [
              { label: 'Rear', value: 'rear' },
              { label: 'Front', value: 'front' },
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ],
            helperText: 'Select which pergola edge connects to the house in drawings and connection counts.',
          } satisfies FieldSchemaItem,
          {
            id: 'drawingRotationQuarterTurns',
            label: 'Drawing rotation',
            type: 'select',
            value: String(activeDrawingRotationQuarterTurns),
            onChange: (v) =>
              setModuleField(
                'drawingRotationQuarterTurns',
                normalizeDrawingRotationQuarterTurns(v) as CalculatorModuleInputs['drawingRotationQuarterTurns'],
              ),
            options: [
              { label: '0 deg', value: '0' },
              { label: '90 deg', value: '1' },
              { label: '180 deg', value: '2' },
              { label: '270 deg', value: '3' },
            ],
            helperText: 'Rotates the drawing preview in 90 degree increments without changing pricing drivers.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintPreset',
            label: 'House footprint',
            type: 'select',
            value: activeHouseFootprintPreset,
            onChange: (v) => setModuleField('houseFootprintPreset', normalizeHouseFootprintPreset(v) as CalculatorModuleInputs['houseFootprintPreset']),
            options: [
              { label: 'Straight', value: 'straight' },
              { label: 'L left', value: 'l_left' },
              { label: 'L right', value: 'l_right' },
              { label: 'Recess left', value: 'recess_left' },
              { label: 'Recess right', value: 'recess_right' },
              { label: 'U shape', value: 'u_shape' },
              { label: 'Wrap left', value: 'wrap_left' },
              { label: 'Wrap right', value: 'wrap_right' },
            ],
            helperText: 'Preset house outline used for the plan preview and drawing sheet.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintBandDepthM',
            label: 'Footprint band depth (m)',
            type: 'number',
            value: activeHouseFootprintParams.bandDepthM,
            onChange: (v) => setHouseFootprintParam('bandDepthM', String(v)),
            helperText: 'Depth of the main hatched house band.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintWidthM',
            label: 'House width (m)',
            type: 'number',
            value: activeHouseFootprintParams.widthM,
            onChange: (v) => setHouseFootprintParam('widthM', String(v)),
            helperText: 'Blank matches the pergola length.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintOffsetXM',
            label: 'House offset X (m)',
            type: 'number',
            value: activeHouseFootprintParams.offsetXM,
            onChange: (v) => setHouseFootprintParam('offsetXM', String(v)),
            helperText: 'Negative values extend left of the pergola.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintSetbackM',
            label: 'Facade setback (m)',
            type: 'number',
            value: activeHouseFootprintParams.setbackM,
            onChange: (v) => setHouseFootprintParam('setbackM', String(v)),
            helperText: 'Visual house context only; pergola attachment stays fixed.',
          } satisfies FieldSchemaItem,
          ...((activeHouseFootprintPreset === 'l_left' || activeHouseFootprintPreset === 'l_right')
            ? [
                {
                  id: 'houseFootprintReturnRunM',
                  label: 'Return run (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.returnRunM,
                  onChange: (v) => setHouseFootprintParam('returnRunM', String(v)),
                } satisfies FieldSchemaItem,
              ]
            : []),
          ...((activeHouseFootprintPreset === 'recess_left' || activeHouseFootprintPreset === 'recess_right')
            ? [
                {
                  id: 'houseFootprintRecessWidthM',
                  label: 'Recess width (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.recessWidthM,
                  onChange: (v) => setHouseFootprintParam('recessWidthM', String(v)),
                } satisfies FieldSchemaItem,
                {
                  id: 'houseFootprintRecessDepthM',
                  label: 'Recess depth (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.recessDepthM,
                  onChange: (v) => setHouseFootprintParam('recessDepthM', String(v)),
                } satisfies FieldSchemaItem,
              ]
            : []),
          ...(activeHouseFootprintPreset === 'u_shape'
            ? [
                {
                  id: 'houseFootprintLeftLegRunM',
                  label: 'Left leg run (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.leftLegRunM,
                  onChange: (v) => setHouseFootprintParam('leftLegRunM', String(v)),
                } satisfies FieldSchemaItem,
                {
                  id: 'houseFootprintRightLegRunM',
                  label: 'Right leg run (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.rightLegRunM,
                  onChange: (v) => setHouseFootprintParam('rightLegRunM', String(v)),
                } satisfies FieldSchemaItem,
              ]
            : []),
          ...((activeHouseFootprintPreset === 'wrap_left' || activeHouseFootprintPreset === 'wrap_right')
            ? [
                {
                  id: 'houseFootprintSideRunM',
                  label: 'Side run (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.sideRunM,
                  onChange: (v) => setHouseFootprintParam('sideRunM', String(v)),
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),
    {
      id: 'postConnectionType',
      label: 'Post connection',
      type: 'select',
      value: activeModule.postConnectionType,
      onChange: (v) => setModuleField('postConnectionType', v as CalculatorModuleInputs['postConnectionType']),
      options: [
        { label: 'Pile (1m)', value: 'pile_1m' },
        { label: 'Pile (1.5m)', value: 'pile_1_5m' },
        { label: 'Deck bracket', value: 'deck_bracket' },
        { label: 'Slab anchors', value: 'slab_anchors' },
      ],
    },
    ...(activeModule.postConnectionType === 'pile_1m' || activeModule.postConnectionType === 'pile_1_5m'
      ? [
          {
            id: 'ground',
            label: 'Ground',
            type: 'select',
            value: activeModule.ground,
            onChange: (v: string | boolean) => setModuleField('ground', v as CalculatorModuleInputs['ground']),
            options: [
              { label: 'Easy', value: 'easy' },
              { label: 'Hard', value: 'hard' },
            ],
            helperText: 'Applies to concrete pile actions',
          } satisfies FieldSchemaItem,
        ]
      : []),
    {
      id: 'access',
      label: 'Access',
      type: 'select',
      value: values.access,
      onChange: (v) => setJobField('access', v as CalculatorInputs['access']),
      options: [
        { label: 'Easy', value: 'easy' },
        { label: 'Normal', value: 'normal' },
        { label: 'Hard', value: 'hard' },
      ],
    },
    {
      id: 'height',
      label: 'Height',
      type: 'select',
      value: values.height,
      onChange: (v) => setJobField('height', v as CalculatorInputs['height']),
      options: [
        { label: 'Single storey', value: 'single_storey' },
        { label: 'Two storey', value: 'two_storey' },
      ],
    },
    {
      id: 'jobType',
      label: 'Job type',
      type: 'select',
      value: values.jobType,
      onChange: (v) => setJobField('jobType', v as CalculatorInputs['jobType']),
      options: [
        { label: 'Residential', value: 'residential' },
        { label: 'Commercial', value: 'commercial' },
      ],
    },

    ...(activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'boxPitchDeg',
            label: 'Box pitch (deg)',
            type: 'readOnly',
            value: typeof derivedBoxPitch === 'number' ? derivedBoxPitch.toFixed(1) : '—',
            helperText: 'Computed from max fall envelope',
          } satisfies FieldSchemaItem,
          {
            id: 'boxRiseMm',
            label: 'Box fall (mm)',
            type: 'readOnly',
            value: typeof derivedBoxRiseMm === 'number' ? derivedBoxRiseMm.toFixed(0) : '—',
            helperText:
              typeof derivedBoxMaxFallMm === 'number' ? `Max allowed: ${Math.round(derivedBoxMaxFallMm)}mm` : 'Max allowed: 200mm',
          } satisfies FieldSchemaItem,
          {
            id: 'boxGutterHouseEdge',
            label: 'House edge gutter',
            type: 'select',
            value: activeModule.boxGutterHouseEdge,
            onChange: (v: string | boolean) => setModuleField('boxGutterHouseEdge', v as CalculatorModuleInputs['boxGutterHouseEdge']),
            options: [
              { label: 'House gutter', value: 'house' },
              { label: 'Our gutter', value: 'our' },
              { label: 'None', value: 'none' },
            ],
          } satisfies FieldSchemaItem,
          {
            id: 'boxGutterFarEdge',
            label: 'Far edge gutter',
            type: 'select',
            value: activeModule.boxGutterFarEdge,
            onChange: (v: string | boolean) => setModuleField('boxGutterFarEdge', v as CalculatorModuleInputs['boxGutterFarEdge']),
            options: [
              { label: 'House gutter', value: 'house' },
              { label: 'Our gutter', value: 'our' },
              { label: 'None', value: 'none' },
            ],
          } satisfies FieldSchemaItem,
        ]
      : []),

    ...(activeModule.roofMaterial !== 'none'
      ? [
          {
            id: 'downpipeCount',
            label: 'Downpipes (count)',
            type: 'number',
            value: activeModule.downpipeCount,
            onChange: (v: string | boolean) => setModuleField('downpipeCount', String(v)),
            error: errors.downpipeCount,
            resolvedDefaultText: resolvedDefaults.downpipeCount,
            helperText: activeModule.boxPerimeterEnabled
              ? 'Default 1 when any "our" gutter edge is set'
              : 'Default 1 when any "our" gutter is used',
          } satisfies FieldSchemaItem,
          {
            id: 'downpipeJoinCount',
            label: 'Downpipe joins',
            type: 'select',
            value: activeModule.downpipeJoinCount,
            onChange: (v: string | boolean) => setModuleField('downpipeJoinCount', String(v)),
            options: DP_JOIN_OPTIONS,
            error: errors.downpipeJoinCount,
            helperText: 'Joins/couplers for downpipe sections (10 min each).',
          } satisfies FieldSchemaItem,
          ...(hasOurGutterUi
            ? [
                {
                  id: 'downpipeElbowCount',
                  label: 'Downpipe elbows',
                  type: 'select',
                  value: activeModule.downpipeElbowCount,
                  onChange: (v: string | boolean) => setModuleField('downpipeElbowCount', String(v)),
                  options: DP_ELBOW_OPTIONS,
                  error: errors.downpipeElbowCount,
                  helperText: 'Elbows/fittings (10 min each). Only applicable when our gutter is used.',
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),
  ];
}
