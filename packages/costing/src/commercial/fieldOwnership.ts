export type CommercialCalculatorFieldOwnerV1 =
  | 'design_intent'
  | 'solved_geometry'
  | 'quantity_takeoff'
  | 'commercial_option'
  | 'site_commercial'
  | 'legacy_compat';

export type CommercialCalculatorFieldOwnershipEntryV1 = {
  field: string;
  owner: CommercialCalculatorFieldOwnerV1;
  notes: string;
};

export const COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1 = {
  projectName: {
    field: 'projectName',
    owner: 'legacy_compat',
    notes: 'Estimate identity/presentation field; not a physical or commercial driver.',
  },
  quoteRef: {
    field: 'quoteRef',
    owner: 'legacy_compat',
    notes: 'Quote reference metadata retained for calculator compatibility.',
  },
  pergolaStyle: {
    field: 'pergolaStyle',
    owner: 'design_intent',
    notes: 'Authored pergola family intent.',
  },
  roofMaterial: {
    field: 'roofMaterial',
    owner: 'design_intent',
    notes: 'Authored roof material selection.',
  },
  extrusionColour: {
    field: 'extrusionColour',
    owner: 'commercial_option',
    notes: 'Finish selection that affects material pricing.',
  },
  lengthM: {
    field: 'lengthM',
    owner: 'solved_geometry',
    notes: 'Primary dimension should come from solved design geometry in the future spine.',
  },
  projectionM: {
    field: 'projectionM',
    owner: 'solved_geometry',
    notes: 'Primary span/projection should come from solved design geometry in the future spine.',
  },
  hipCornerLengthBM: {
    field: 'hipCornerLengthBM',
    owner: 'solved_geometry',
    notes: 'Secondary hip-corner dimension belongs to solved geometry.',
  },
  hipCornerProjectionBM: {
    field: 'hipCornerProjectionBM',
    owner: 'solved_geometry',
    notes: 'Secondary hip-corner span belongs to solved geometry.',
  },
  postCutHeightM: {
    field: 'postCutHeightM',
    owner: 'solved_geometry',
    notes: 'Post height is a physical output of the resolved assembly.',
  },
  roofPitchDeg: {
    field: 'roofPitchDeg',
    owner: 'design_intent',
    notes: 'Authored roof pitch intent before geometry validation.',
  },
  postCount: {
    field: 'postCount',
    owner: 'quantity_takeoff',
    notes: 'Post quantity should be derived or overridden as a takeoff driver.',
  },
  houseConnectionType: {
    field: 'houseConnectionType',
    owner: 'design_intent',
    notes: 'Authored relationship to the house.',
  },
  attachmentSide: {
    field: 'attachmentSide',
    owner: 'design_intent',
    notes: 'Authored host side; solved geometry resolves the exact host edge or zone.',
  },
  postConnectionType: {
    field: 'postConnectionType',
    owner: 'design_intent',
    notes: 'Authored support/footing intent.',
  },
  ground: {
    field: 'ground',
    owner: 'site_commercial',
    notes: 'Site condition used by install and footing pricing.',
  },
  flashings: {
    field: 'flashings',
    owner: 'commercial_option',
    notes: 'Manual/default flashing options feed takeoff and material pricing.',
  },
  infills: {
    field: 'infills',
    owner: 'commercial_option',
    notes: 'Accessory design options with their own takeoff bucket.',
  },
  blinds: {
    field: 'blinds',
    owner: 'commercial_option',
    notes: 'Site-level accessory options outside the structural pergola solve.',
  },
  overrides: {
    field: 'overrides',
    owner: 'commercial_option',
    notes: 'Commercial profile overrides should remain explicit options.',
  },
  travelExGst: {
    field: 'travelExGst',
    owner: 'site_commercial',
    notes: 'Site-level commercial allowance.',
  },
  extrasAllowanceExGst: {
    field: 'extrasAllowanceExGst',
    owner: 'site_commercial',
    notes: 'Site-level commercial allowance.',
  },
  quoteDiscountPct: {
    field: 'quoteDiscountPct',
    owner: 'site_commercial',
    notes: 'Commercial quote adjustment.',
  },
  access: {
    field: 'access',
    owner: 'site_commercial',
    notes: 'Site-level install multiplier input.',
  },
  height: {
    field: 'height',
    owner: 'site_commercial',
    notes: 'Site-level install multiplier input.',
  },
  jobType: {
    field: 'jobType',
    owner: 'site_commercial',
    notes: 'Site-level commercial and overhead policy input.',
  },
} as const satisfies Record<string, CommercialCalculatorFieldOwnershipEntryV1>;

export type CommercialCalculatorFieldNameV1 = keyof typeof COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1;

export function getCommercialCalculatorFieldOwnershipV1(
  field: string,
): CommercialCalculatorFieldOwnershipEntryV1 | null {
  return (
    COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1[
      field as CommercialCalculatorFieldNameV1
    ] ?? null
  );
}
