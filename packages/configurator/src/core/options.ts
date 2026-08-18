import type {
  CustomerAcrylicTintV1,
  CustomerAttachmentSideV1,
  CustomerBlindFabricV1,
  CustomerBlindOperationV1,
  CustomerConnectionIntentV1,
  CustomerDownlightIntentV1,
  CustomerEdgeIdV1,
  CustomerFrameFinishV1,
  CustomerHeatingInterestV1,
  CustomerHouseFootprintV1,
  CustomerHouseRoofFormV1,
  CustomerHouseStoreysV1,
  CustomerMixedRoofLayoutV1,
  CustomerPergolaFamilyV1,
  CustomerPlacementModeV1,
  CustomerSiteLevelV1,
} from './contracts';

export type CustomerOption<T extends string> = {
  value: T;
  label: string;
};

export type CustomerDimensionBounds = {
  minimum: number;
  maximum: number;
  step: number;
};

export const CUSTOMER_DIMENSION_BOUNDS = {
  lengthMm: { minimum: 1_500, maximum: 15_000, step: 100 },
  projectionMm: { minimum: 1_500, maximum: 10_000, step: 100 },
  clearHeightMm: { minimum: 2_000, maximum: 5_000, step: 50 },
} as const satisfies Record<string, CustomerDimensionBounds>;

export const CUSTOMER_CUSTOM_COLOUR_NAME_MAX_LENGTH = 80;
export const CUSTOMER_SOURCE_PATH_MAX_LENGTH = 256;
export const CUSTOMER_SOURCE_SLUG_MAX_LENGTH = 100;

export const CUSTOMER_EDGE_IDS = ['front', 'left', 'right', 'rear'] as const satisfies readonly CustomerEdgeIdV1[];

export const CUSTOMER_PERGOLA_FAMILY_OPTIONS = [
  { value: 'mono', label: 'Pitched' },
  { value: 'gable', label: 'Gable' },
  { value: 'hip', label: 'Hip' },
  { value: 'box', label: 'Box perimeter' },
] as const satisfies readonly CustomerOption<CustomerPergolaFamilyV1>[];

export const CUSTOMER_PLACEMENT_OPTIONS = [
  { value: 'attached', label: 'Attached to the house' },
  { value: 'freestanding', label: 'Freestanding' },
] as const satisfies readonly CustomerOption<CustomerPlacementModeV1>[];

export const CUSTOMER_ATTACHMENT_SIDE_OPTIONS = [
  { value: 'rear', label: 'Rear' },
  { value: 'front', label: 'Front' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
] as const satisfies readonly CustomerOption<CustomerAttachmentSideV1>[];

export const CUSTOMER_CONNECTION_OPTIONS = [
  { value: 'unsure', label: 'Not sure' },
  { value: 'soffit', label: 'Soffit' },
  { value: 'fascia', label: 'Fascia' },
  { value: 'wall', label: 'Wall' },
  { value: 'none', label: 'No house connection' },
] as const satisfies readonly CustomerOption<CustomerConnectionIntentV1>[];

export const CUSTOMER_FRAME_FINISH_OPTIONS = [
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly CustomerOption<CustomerFrameFinishV1>[];

export const CUSTOMER_ACRYLIC_TINT_OPTIONS = [
  { value: 'clear', label: 'Clear' },
  { value: 'light_grey', label: 'Light grey' },
  { value: 'dark_grey', label: 'Dark grey' },
  { value: 'opal', label: 'Opal' },
] as const satisfies readonly CustomerOption<CustomerAcrylicTintV1>[];

export const CUSTOMER_MIXED_ROOF_LAYOUT_OPTIONS = [
  { value: 'central_skylight_narrow', label: 'Narrow central skylight' },
  { value: 'central_skylight_standard', label: 'Standard central skylight' },
  { value: 'central_skylight_wide', label: 'Wide central skylight' },
] as const satisfies readonly CustomerOption<CustomerMixedRoofLayoutV1>[];

export const CUSTOMER_BLIND_FABRIC_OPTIONS = [
  { value: 'mesh', label: 'Mesh' },
  { value: 'fine_mesh', label: 'Fine mesh' },
  { value: 'clear_pvc', label: 'Clear PVC' },
] as const satisfies readonly CustomerOption<CustomerBlindFabricV1>[];

export const CUSTOMER_BLIND_OPERATION_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'motorised', label: 'Motorised' },
] as const satisfies readonly CustomerOption<CustomerBlindOperationV1>[];

export const CUSTOMER_DOWNLIGHT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'standard', label: 'Standard' },
  { value: 'bright', label: 'Bright' },
] as const satisfies readonly CustomerOption<CustomerDownlightIntentV1>[];

export const CUSTOMER_HEATING_OPTIONS = [
  { value: 'none', label: 'No heating interest' },
  { value: 'interested', label: 'Interested in heating' },
] as const satisfies readonly CustomerOption<CustomerHeatingInterestV1>[];

export const CUSTOMER_SITE_LEVEL_OPTIONS = [
  { value: 'ground', label: 'Ground' },
  { value: 'deck', label: 'Deck' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'unsure', label: 'Not sure' },
] as const satisfies readonly CustomerOption<CustomerSiteLevelV1>[];

export const CUSTOMER_HOUSE_FOOTPRINT_OPTIONS = [
  { value: 'straight', label: 'Straight' },
  { value: 'l_left', label: 'L shape - left' },
  { value: 'l_right', label: 'L shape - right' },
  { value: 'recess_left', label: 'Recess - left' },
  { value: 'recess_right', label: 'Recess - right' },
] as const satisfies readonly CustomerOption<CustomerHouseFootprintV1>[];

export const CUSTOMER_HOUSE_STOREY_OPTIONS = [
  { value: 'one', label: 'One storey' },
  { value: 'two', label: 'Two storeys' },
  { value: 'unsure', label: 'Not sure' },
] as const satisfies readonly CustomerOption<CustomerHouseStoreysV1>[];

export const CUSTOMER_HOUSE_ROOF_OPTIONS = [
  { value: 'hipped', label: 'Hipped' },
  { value: 'gable', label: 'Gable' },
  { value: 'mono', label: 'Mono pitch' },
  { value: 'flat', label: 'Flat' },
  { value: 'unsure', label: 'Not sure' },
] as const satisfies readonly CustomerOption<CustomerHouseRoofFormV1>[];
