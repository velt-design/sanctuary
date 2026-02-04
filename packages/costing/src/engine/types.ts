export type CostBasis = 'ex_gst';

export type Currency = 'NZD';

export type StructureType = 'pitched' | 'box_perimeter';

export type PergolaStyleUi = 'pitched' | 'gable' | 'hip' | 'hip_corner' | 'box_perimeter';

export type RoofMaterial = 'acrylic' | 'timber' | 'mixed';

export type TimberRoofAboveType = 'insulated_panels' | 'steel_corrugated' | 'steel_tray';

export type RoofType = 'pitched' | 'low_gable' | 'gable' | 'hip' | 'hip_corner';

export type ExtrusionColour = 'Black' | 'White' | 'Mill';

export type GableEndFramesMode = 'none' | 'outer_end_only' | 'both_ends';

export type GutterType = 'sp_gutter' | 'box_gutter_100x100x3' | 'box_gutter_100x100_cut';
export type BoxGutterEdge = 'house' | 'our' | 'none';
export type OverhangSupportBeamProfile = string;
export type GutterMode = 'default' | 'none' | 'sp_gutter_house_edge' | 'overhang_gutter_front_edge';
export type GutterAssemblyMode = 'integrated' | 'separate' | 'none';
export type SlopeDirection = 'away_from_house' | 'toward_house';

export type HouseConnectionType = 'soffit' | 'fascia' | 'facade' | 'none';

export type PostConnectionType =
  | 'pile_1m'
  | 'pile_1_5m'
  | 'deck_bracket'
  | 'slab_anchors';

export type AccessLevel = 'easy' | 'normal' | 'hard';

export type HeightCategory = 'single_storey' | 'two_storey';

export type GroundCondition = 'easy' | 'hard';

export type RafterProfile = string;

export type BoxBeamProfile = string;

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
  roof_span_m?: number;
  projection_m?: number; // legacy alias for roof_span_m
  post_cut_height_m?: number;
  roof_pitch_deg?: number;

  pergola_style: PergolaStyleUi;
  roof_material: RoofMaterial;
  extrusion_colour: ExtrusionColour;
  gable_end_frames_mode?: GableEndFramesMode;
  powdercoat_standard_colour?: string;
  powdercoat_is_custom?: boolean;
  powdercoat_custom_colour?: string;
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
  gutter_length_m?: number;
  downpipe_count?: number;
  downpipe_join_count?: number;
  downpipe_elbow_count?: number;
  box_gutter_house_edge?: BoxGutterEdge;
  box_gutter_far_edge?: BoxGutterEdge;
  overhang_enabled?: boolean;
  overhang_amount_m?: number;
  overhang_support_beam_profile?: OverhangSupportBeamProfile;
  inverted_enabled?: boolean;
  inverted_house_gutter?: boolean;
  separate_gutter_enabled?: boolean;
  overrides?: {
    ledger_profile?: string;
    rafter_profile?: string;
    post_profile?: string;
    front_beam_profile?: string;
    ridge_beam_profile?: string;
    box_perimeter_beam_profile?: string;
    overhang_support_beam_profile?: string;
    tie_beam_profile?: string;
    strut_profile?: string;
  };

  travel_ex_gst?: number;
  extras_allowance_ex_gst?: number;
  timber_roof_allowance_ex_gst?: number;
  timber_roof_above_type?: TimberRoofAboveType;
  timber_insulated_panel_thickness_mm?: number;
  timber_tray_width_mm?: number;

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
  gable_end_frames_mode: GableEndFramesMode;
  powdercoat_standard_colour?: string;
  powdercoat_is_custom?: boolean;
  powdercoat_custom_colour?: string;
  mixed_roof: MixedRoofNormalizedV1 | null;

  post_count: number;
  house_connection_type: HouseConnectionType;
  post_connection_type: PostConnectionType;
  access: AccessLevel;
  height: HeightCategory;
  ground: GroundCondition;

  box_beam_profile: BoxBeamProfile | null;
  fall_distance_mm: number | null;
  gutter_length_m: number;
  downpipe_count: number;
  downpipe_join_count: number;
  downpipe_elbow_count: number;
  box_gutter_house_edge: BoxGutterEdge;
  box_gutter_far_edge: BoxGutterEdge;
  overhang_enabled: boolean;
  overhang_amount_m: number;
  overhang_support_beam_profile: OverhangSupportBeamProfile | null;
  inverted_enabled: boolean;
  inverted_house_gutter: boolean;
  separate_gutter_enabled: boolean;

  rafter_profile: RafterProfile;
  gutter_type: GutterType | null;
  acrylic_sheet_count: number;
  flashing_length_m: number;
  foam_length_m: number;

  travel_ex_gst: number;
  extras_allowance_ex_gst: number;
  timber_roof_allowance_ex_gst: number;
  timber_roof_above_type: TimberRoofAboveType;
  timber_insulated_panel_thickness_mm: number;
  timber_tray_width_mm: number;

  quote_discount_pct: number;
};

export type DerivedV1 = {
  area_m2: number;
  length_m: number;
  projection_m: number;
  roof_length_m: number;
  roof_span_m: number;
  roof_plane_span_m: number;
  roof_plane_sloped_downslope_m: number;
  roof_area_total_m2: number;
  box_max_fall_mm?: number;
  box_effective_run_m?: number;
  box_pitch_deg_used?: number;
  box_rise_mm?: number;
  box_max_supported_run_m_at_min_pitch?: number;
  box_max_supported_span_m?: number;
  ridge_beam_profile_used?: string | null;
  front_beam_profile_used?: string | null;
  box_perimeter_beam_profile_used?: string | null;
  post_profile_used?: string | null;
  tie_beam_profile_used?: string | null;
  strut_profile_used?: string | null;
  our_gutter_length_m?: number;
  house_gutter_length_m?: number;
  overhang_enabled?: boolean;
  overhang_amount_m?: number;
  overhang_support_beam_profile_used?: string | null;
  overhang_support_beam_length_m?: number;
  overhang_stringer_profile_used?: string | null;
  overhang_stringer_length_m?: number;
  overhang_end_cap_count?: number;
  inverted_enabled?: boolean;
  inverted_house_gutter?: boolean;
  slope_direction?: SlopeDirection;
  gutter_mode?: GutterMode;
  gutter_assembly_mode?: GutterAssemblyMode;
  integrated_gutter_beam?: boolean;
  has_our_gutter?: boolean;
  downpipe_join_count_used?: number;
  downpipe_elbow_count_used?: number;
  separate_gutter_enabled?: boolean;
  separate_gutter_length_m?: number;
  ledger_profile_used?: string;
  ledger_underside_height_m?: number;
  post_cut_height_house_side_m?: number;
  post_cut_height_outer_side_m?: number;
  module_count: number;
  site_days?: number;
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
  cut_rafter_length_m: number;
  angle_cut_allowance_m: number;
  acrylic_required_downslope_m: number;
  effective_run_m: number;
  required_downslope_m: number;
  total_roof_area_m2: number;
  roof_surface_area_m2: number;
  ridge_length_m: number;
  acrylic_area_m2: number;
  timber_area_m2: number;
  timber_plane_count: number;
  visible_finish_used: string;
  timber_edge_rafter_profile_used: string;
  timber_edge_rafter_finish_used: string;
  timber_edge_rafter_count_per_plane: number;
  timber_edge_rafter_count_total: number;
  timber_common_rafter_count_per_plane: number;
  timber_common_rafter_count_total: number;
  timber_run_per_plane_m: number;
  timber_slope_len_per_plane_m: number;
  timber_purlin_lines_per_plane: number;
  timber_purlin_total_m: number;
  timber_hidden_finish: string;
  roof_slope_area_m2: number;
  timber_roof_above_area_m2: number;
  timber_insulated_panel_count_per_plane: number;
  timber_insulated_panel_count_total: number;
  timber_tray_sheet_count_per_plane: number;
  timber_tray_sheet_count_total: number;
  covertek_area_m2: number;
  polystyrene_area_m2: number;
  timber_roofing_screws_steel_count: number;
  timber_roofing_screws_insulated_count: number;
  roof_plane_count: number;
  total_rafter_pieces: number;
  joiner_runs_total: number;
  splice_join_count?: number;
  acrylic_plane_count_used?: number;
  gable_end_frame_count?: number;
  tie_beam_length_m?: number;
  kingpost_strut_length_m?: number;
  powdercoat_colour_used?: string | null;
  powdercoat_multiplier?: number | null;
  gutter_length_m: number;
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
