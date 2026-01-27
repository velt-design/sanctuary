export type CostBasis = 'ex_gst';

export type Currency = 'NZD';

export type StructureType = 'pitched' | 'box_perimeter';

export type PergolaStyleUi = 'pitched' | 'gable' | 'hip' | 'hip_corner' | 'box_perimeter';

export type RoofMaterial = 'acrylic' | 'timber' | 'mixed';

export type RoofType = 'pitched' | 'low_gable' | 'gable' | 'hip' | 'hip_corner';

export type ExtrusionColour = 'Black' | 'White' | 'Mill';

export type GutterType = 'sp_gutter';

export type HouseConnectionType = 'soffit' | 'fascia' | 'facade';

export type PostConnectionType =
  | 'pile_1m'
  | 'pile_1_5m'
  | 'deck_bracket'
  | 'slab_anchors';

export type AccessLevel = 'easy' | 'normal' | 'hard';

export type HeightCategory = 'single_storey' | 'two_storey';

export type GroundCondition = 'easy' | 'hard';

export type RafterProfile = '80x50' | '100x50' | '150x50';

export type BoxBeamProfile = '300x50';

export type MixedRoofMode = 'ridge_skylight' | 'area_override' | 'acrylic_bays';

export type MixedRoofInputsV1 = {
  mode?: MixedRoofMode;
  ridge_skylight?: {
    strip_count?: number;
    strip_width_m?: number;
  };
  acrylic_area_m2?: number;
  acrylic_bays_by_plane?: Record<string, number>;
};

export type HipCornerInputsV1 = {
  length_b_m?: number;
  projection_b_m?: number;
};

export type MixedRoofNormalizedV1 = {
  mode: MixedRoofMode;
  ridge_skylight: {
    strip_count: number;
    strip_width_m: number;
  } | null;
  acrylic_area_m2_override: number | null;
  acrylic_bays_by_plane: Record<string, number> | null;
};

export type CostInputsV1 = {
  length_m: number;
  projection_m: number;
  post_cut_height_m?: number;
  roof_pitch_deg?: number;

  pergola_style: PergolaStyleUi;
  roof_material: RoofMaterial;
  extrusion_colour: ExtrusionColour;
  mixed_roof?: MixedRoofInputsV1;
  hip_corner?: HipCornerInputsV1;

  post_count?: number;
  house_connection_type: HouseConnectionType;
  post_connection_type: PostConnectionType;
  access: AccessLevel;
  height: HeightCategory;
  ground?: GroundCondition;

  box_perimeter_enabled?: boolean;
  internal_roof_type?: RoofType;
  fall_distance_mm?: number;

  travel_ex_gst?: number;
  extras_allowance_ex_gst?: number;
  timber_roof_allowance_ex_gst?: number;

  quote_discount_pct?: number;
};

export type InputsNormalizedV1 = {
  length_m: number;
  projection_m: number;
  hip_corner_length_b_m: number | null;
  hip_corner_projection_b_m: number | null;
  post_cut_height_m: number;
  roof_pitch_deg: number | null;

  structure_type: StructureType;
  pergola_style_ui: PergolaStyleUi;
  roof_material: RoofMaterial;
  roof_type: RoofType;
  extrusion_colour: ExtrusionColour;
  mixed_roof: MixedRoofNormalizedV1 | null;

  post_count: number;
  house_connection_type: HouseConnectionType;
  post_connection_type: PostConnectionType;
  access: AccessLevel;
  height: HeightCategory;
  ground: GroundCondition;

  box_beam_profile: BoxBeamProfile | null;
  fall_distance_mm: number | null;

  rafter_profile: RafterProfile;
  gutter_type: GutterType | null;
  acrylic_sheet_count: number;
  flashing_length_m: number;
  foam_length_m: number;

  travel_ex_gst: number;
  extras_allowance_ex_gst: number;
  timber_roof_allowance_ex_gst: number;

  quote_discount_pct: number;
};

export type DerivedV1 = {
  area_m2: number;
  length_m: number;
  projection_m: number;
  module_count: number;
  hip_corner_length_b_m?: number;
  hip_corner_projection_b_m?: number;
  hip_corner_rafter_count_a?: number;
  hip_corner_rafter_count_b?: number;
  rafter_count: number;
  bracket_count: number;
  stringer_fixing_count: number;
  bay_count: number;
  rafter_profile_auto: RafterProfile;
  rafter_length_m_assumed: number;
  roof_pitch_deg_used: number;
  rafter_run_m: number;
  rafter_length_m: number;
  rafter_run_m_takeoff: number;
  rafter_cut_length_m: number;
  joiner_piece_length_m: number;
  effective_run_m: number;
  required_downslope_m: number;
  roof_surface_area_m2: number;
  ridge_length_m: number;
  acrylic_area_m2: number;
  timber_area_m2: number;
  roof_planes: Array<{
    id: string;
    label: string;
    bay_count: number;
    rafter_length_m: number;
    roof_area_m2: number;
  }>;
  acrylic_bays_total?: number;
  hip_rafter_count: number;
  box_perimeter_m?: number;
};

export type MaterialsLineV1 = {
  id: string;
  label: string;
  profile?: string | null;
  unit: string;
  qty: number;
  unit_cost_ex_gst: number;
  line_cost_ex_gst: number;
  notes?: string | null;
};

export type MaterialsTotalsV1 = {
  materials_ex_gst: number;
  waste_m_by_profile: Record<string, number>;
  bars_by_profile: Record<string, { stock_length_m: number; bars_used: number }>;
};

export type MaterialsV1 = {
  lines: MaterialsLineV1[];
  totals: MaterialsTotalsV1;
};

export type InstallActionV1 = {
  id: string;
  category: string;
  label: string;
  scope?: 'job' | 'module';
  unit: string;
  qty: number;
  minutes: number;
  applied_multipliers: Record<string, number>;
  cost_ex_gst: number;
};

export type InstallTotalsV1 = {
  crew_minutes: number;
  crew_hours: number;
  install_ex_gst: number;
};

export type InstallV1 = {
  actions: InstallActionV1[];
  totals: InstallTotalsV1;
};

export type OverheadV1 = {
  method: string;
  ops_ex_gst: number;
  sales_ex_gst: number;
  total_ex_gst: number;
};

export type AddOnsV1 = {
  travel_ex_gst: number;
  extras_allowance_ex_gst: number;
  timber_roof_allowance_ex_gst?: number;
};

export type WarningLevelV1 = 'critical' | 'info';

export type WarningV1 = {
  level: WarningLevelV1;
  message: string;
};

export type TotalsV1 = {
  cost_ex_gst: number;
  cost_inc_gst: number;
  warnings: WarningV1[];
  // Back-compat for older UI/snapshots; prefer `warnings`.
  notes_and_warnings: string[];
};

export type CostOutputV1 = {
  inputs_normalized: InputsNormalizedV1;
  derived: DerivedV1;
  materials: MaterialsV1;
  install: InstallV1;
  overhead: OverheadV1;
  add_ons: AddOnsV1;
  totals: TotalsV1;
};

export type JobInputsV1 = {
  modules: CostInputsV1[];
  travel_ex_gst?: number;
  extras_allowance_ex_gst?: number;
  quote_discount_pct?: number;
};

export type JobOutputV1 = {
  module_count: number;
  modules: CostOutputV1[];
  materials: MaterialsV1;
  install: InstallV1;
  overhead: OverheadV1;
  add_ons: AddOnsV1;
  totals: TotalsV1;
};
