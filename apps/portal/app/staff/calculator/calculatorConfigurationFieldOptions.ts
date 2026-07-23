import type { FieldOption } from './FieldTile';

const DEFAULT_OVERRIDE_OPTION: FieldOption = { label: 'Default (auto)', value: '' };

export const RAFTER_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '80x50', value: '80x50' },
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
];

export const LEDGER_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '80x50', value: '80x50' },
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
];

export const POST_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '80x50', value: '80x50' },
  { label: '100x50', value: '100x50' },
  { label: '150x100', value: '150x100' },
  { label: '100x100', value: '100x100' },
  { label: '150x150', value: '150x150' },
];

export const FRONT_BEAM_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: 'SP Gutter', value: 'SP Gutter' },
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
  { label: '300x50', value: '300x50' },
  { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' },
];

export const RIDGE_BEAM_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
  { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' },
];

export const BOX_BEAM_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '300x50', value: '300x50' },
  { label: '250x50', value: '250x50' },
  { label: '200x50', value: '200x50' },
];

export const STRUT_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '50x50', value: '50x50' },
  { label: '80x50', value: '80x50' },
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
];

export const DP_JOIN_OPTIONS: FieldOption[] = Array.from({ length: 11 }, (_, index) => ({
  label: String(index),
  value: String(index),
}));

export const DP_ELBOW_OPTIONS: FieldOption[] = Array.from({ length: 21 }, (_, index) => ({
  label: String(index),
  value: String(index),
}));

export const GABLE_END_FRAME_OPTIONS: FieldOption[] = [
  { label: 'None', value: 'none' },
  { label: 'Outer end only', value: 'outer_end_only' },
  { label: 'Both ends', value: 'both_ends' },
];

export const GABLE_GUTTER_OPTIONS: FieldOption[] = [
  { label: 'House gutter', value: 'house' },
  { label: 'Our gutter (SP)', value: 'our' },
];

export const POWDERCOAT_STANDARD_COLOURS = [
  'Ironsands',
  'Charcoal',
  'Grey Friars',
  'Flaxpod',
  'Rangoon Green',
  'Gull Grey',
  'Titania',
];
