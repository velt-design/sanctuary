import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
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

export type CalculatorSiteFieldBuilderInput = {
  activeModule: CalculatorModuleInputs;
  values: CalculatorInputs;
  errors: Partial<Record<keyof CalculatorModuleInputs, string>>;
  resolvedDefaults: CalculatorResolvedDefaultTexts;
  derivedBoxPitch: number | undefined;
  derivedBoxRiseMm: number | undefined;
  derivedBoxMaxFallMm: number | undefined;
  hasOurGutterUi: boolean;
  setModuleField: CalculatorModuleFieldSetter;
  setJobField: CalculatorJobFieldSetter;
};

export function buildCalculatorSiteFields({
  activeModule,
  values,
  errors,
  resolvedDefaults,
  derivedBoxPitch,
  derivedBoxRiseMm,
  derivedBoxMaxFallMm,
  hasOurGutterUi,
  setModuleField,
  setJobField,
}: CalculatorSiteFieldBuilderInput): FieldSchemaItem[] {
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
