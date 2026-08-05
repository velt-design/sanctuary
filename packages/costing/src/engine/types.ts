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
export type AttachmentSide = 'rear' | 'front' | 'left' | 'right';

export type PostConnectionType =
  | 'pile_1m'
  | 'pile_1_5m'
  | 'deck_bracket'
  | 'slab_anchors';

export type AccessLevel = 'easy' | 'normal' | 'hard';

export type HeightCategory = 'single_storey' | 'two_storey';

export type GroundCondition = 'easy' | 'hard';

export type JobType = 'residential' | 'commercial';

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

export type FlashingBandV1 = '0-200' | '201-300' | '301-400';
export type FlashingBandOrNoneV1 = FlashingBandV1 | 'none';

export type FlashingDefaultOverrideV1 = {
  key: string;
  band?: FlashingBandOrNoneV1;
};

export type FlashingExtraInputV1 = {
  band?: FlashingBandV1;
  length_m?: number;
};

export type FlashingInputsV1 = {
  default_overrides?: FlashingDefaultOverrideV1[];
  extras?: FlashingExtraInputV1[];
};

export type FlashingDefaultNormalizedV1 = {
  key: string;
  label: string;
  length_m: number;
  default_band: FlashingBandV1;
  selected_band: FlashingBandOrNoneV1;
};

export type FlashingExtraNormalizedV1 = {
  band: FlashingBandV1;
  length_m: number;
};

export type FlashingNormalizedV1 = {
  defaults: FlashingDefaultNormalizedV1[];
  extras: FlashingExtraNormalizedV1[];
  totals_m_by_band: Record<FlashingBandV1, number>;
  total_length_m: number;
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

export type InfillLocationV1 = 'front' | 'house' | 'side' | 'gable_end' | 'wall' | 'custom';
export type InfillAcrylicSourceV1 = 'strip_620' | 'sheet_panels';
export type InfillWidthModeV1 = 'match_roof_rafters' | 'target_width';
export type InfillPanelOrientationV1 = 'vertical' | 'horizontal';

export type InfillSupportV1 = {
  has_top: boolean;
  has_bottom: boolean;
  has_left: boolean;
  has_right: boolean;
  internal_support_mode?: 'none' | 'match_roof_rafters' | 'center' | 'custom';
  internal_support_positions_m?: number[];
};

export type InfillShapeV1 =
  | {
      type: 'rect';
      width_m: number;
      height_m: number;
      bottom_offset_m?: number;
    }
  | {
      type: 'mono_slope';
      width_m: number;
      height_low_m: number;
      height_high_m: number;
      bottom_offset_m?: number;
    };

export type InfillInputV1 = {
  id: string;
  label?: string;
  qty?: number;
  location: InfillLocationV1;
  acrylic_source: InfillAcrylicSourceV1;
  panel_orientation?: InfillPanelOrientationV1;
  width_mode: InfillWidthModeV1;
  target_panel_width_m?: number;
  max_panel_width_m?: number;
  support: InfillSupportV1;
  shape: InfillShapeV1;
};

export type InfillRequestedPanelOrientationV1 = InfillPanelOrientationV1 | 'auto';
export type InfillRequestedAcrylicSourceV1 = InfillAcrylicSourceV1 | 'auto';

export type InfillTakeoffInputV1 = Omit<InfillInputV1, 'panel_orientation' | 'acrylic_source'> & {
  acrylic_source: InfillRequestedAcrylicSourceV1;
  module_id?: string;
  panel_orientation?: InfillRequestedPanelOrientationV1;
};

export type InfillTakeoffPointV1 = { x_m: number; y_m: number };

export type InfillPanelPieceV1 = {
  id: string;
  module_id: string;
  infill_id: string;
  instance_index: number;
  panel_index: number;
  acrylic_source: InfillAcrylicSourceV1;
  orientation: InfillPanelOrientationV1;
  shape: 'rectangle' | 'trapezoid' | 'triangle';
  points: InfillTakeoffPointV1[];
  finished_width_m: number;
  finished_height_m: number;
  finished_area_m2: number;
  blank_width_m: number;
  blank_length_m: number;
};

export type InfillLinearCutRoleV1 =
  | 'joiner_top'
  | 'joiner_bottom'
  | 'joiner_left'
  | 'joiner_right'
  | 'joiner_internal'
  | 'support_top'
  | 'support_bottom'
  | 'support_left'
  | 'support_right'
  | 'support_internal';

export type InfillLinearCutV1 = {
  id: string;
  module_id: string;
  infill_id: string;
  instance_index: number;
  role: InfillLinearCutRoleV1;
  profile: 'Joiners' | '50x50';
  colour?: string;
  length_m: number;
  boundary_position_m?: number;
};

export type InfillStockAllocationV1 = {
  stock_index: number;
  piece_ids: string[];
  used_m?: number;
  waste_m?: number;
  placements?: Array<{
    piece_id: string;
    x_m: number;
    y_m: number;
    width_m: number;
    height_m: number;
    rotated: boolean;
  }>;
};

export type InfillStockPurchaseV1 = {
  id: string;
  material: 'acrylic_sheet' | 'crystalite_620' | 'joiner' | 'support_50x50';
  profile?: 'Joiners' | '50x50';
  colour?: string;
  stock_length_m: number;
  stock_width_m?: number;
  qty: number;
  total_stock_m?: number;
  total_cut_m?: number;
  waste_m?: number;
  total_stock_m2?: number;
  total_cut_m2?: number;
  waste_m2?: number;
  allocations: InfillStockAllocationV1[];
};

export type InfillTakeoffWarningV1 = {
  level: 'critical' | 'info';
  code:
    | 'invalid_geometry'
    | 'source_auto_switched'
    | 'source_unavailable'
    | 'stock_unavailable'
    | 'rafter_context_required'
    | 'partial_rafter_match';
  message: string;
  module_id?: string;
  infill_id?: string;
};

export type InfillTakeoffItemV1 = {
  module_id: string;
  infill_id: string;
  label?: string;
  requested_acrylic_source: InfillRequestedAcrylicSourceV1;
  resolved_acrylic_source: InfillAcrylicSourceV1;
  requested_orientation: InfillRequestedPanelOrientationV1;
  resolved_orientation: InfillPanelOrientationV1;
  panels: InfillPanelPieceV1[];
  linear_cuts: InfillLinearCutV1[];
  warnings: InfillTakeoffWarningV1[];
};

export type InfillTakeoffV1 = {
  schema_version: 'infill_takeoff_v1';
  status: 'valid' | 'blocked';
  scope_id: string;
  kerf_m: number;
  items: InfillTakeoffItemV1[];
  purchases: InfillStockPurchaseV1[];
  warnings: InfillTakeoffWarningV1[];
  totals: {
    instance_count: number;
    panel_count: number;
    panel_area_m2: number;
    joiner_cut_m: number;
    support_cut_m: number;
    extra_support_count: number;
    sheet_count: number;
    strip_stock_count: number;
  };
};

export type InfillCostComponentsV1 = {
  materials_ex_gst: number;
  install_ex_gst: number;
  overhead_ex_gst: number;
  total_ex_gst: number;
};

export type InfillCostBreakdownItemV1 = InfillCostComponentsV1 & {
  module_id: string;
  infill_id: string;
  label?: string;
  quantity: number;
};

export type InfillCostBreakdownV1 = {
  schema_version: 'infill_cost_breakdown_v1';
  source: '@sp/costing/engine/infill-cost-attribution-v1';
  status: 'ready' | 'blocked';
  scope_id: string;
  allocation: {
    pooled_materials: 'stock_piece_usage';
    install: 'infill_labour_drivers';
    overhead: 'proportional_direct_cost';
  };
  items: InfillCostBreakdownItemV1[];
  remainder: InfillCostComponentsV1;
  totals: InfillCostComponentsV1;
  notes_and_warnings: string[];
};

export type InfillCostBreakdownV2 = {
  schema_version: 'infill_cost_breakdown_v2';
  source: '@sp/costing/engine/infill-incremental-baseline-v2';
  status: 'ready' | 'blocked';
  scope_id: string;
  allocation: {
    baseline: 'site_rerun_without_infills';
    pooled_materials: 'stock_piece_usage';
    install: 'infill_labour_drivers';
    overhead: 'proportional_direct_cost';
  };
  items: InfillCostBreakdownItemV1[];
  baseline: InfillCostComponentsV1;
  baseline_shared_cost_ex_gst: number;
  totals: InfillCostComponentsV1;
  notes_and_warnings: string[];
};

export type CalculateInfillsTakeoffOptionsV1 = {
  scope_id?: string;
  module_id?: string;
  rafter_spacing_m?: number | null;
  edge_length_m?: number | null;
  extrusion_colour?: string;
  kerf_m?: number;
  sheet_stock_length_m?: number;
  sheet_stock_width_m?: number;
  strip_stock_lengths_m?: number[];
  joiner_stock_lengths_m?: number[];
  support_stock_lengths_m?: number[];
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
  flashings?: FlashingInputsV1;

  post_count?: number;
  house_connection_type: HouseConnectionType;
  /**
   * PR-F (2026-05-22): replaces legacy `attachment_side` enum. Length of
   * the pergola edge that meets the host wall (mm). Used for bracket /
   * stringer-fixing count calculations. When `null` / `undefined`, the
   * cost engine defaults to `length_m * 1000` (the pergola's long-side
   * length — equivalent to the legacy `attachment_side: 'rear' | 'front'`
   * behavior). Workbench callers derive this from the pergola's snap-
   * attached edge length. Marketing-form enquiries leave this unset
   * (defaults preserve historical cost output).
   */
  attachment_length_mm?: number | null;
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
  gable_house_edge_gutter?: 'house' | 'our';
  gable_outer_edge_gutter?: 'house' | 'our';
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
  infills?: InfillInputV1[];

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
  /** PR-F (2026-05-22): echoed from input. See `CostInputsV1.attachment_length_mm`. */
  attachment_length_mm: number;
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
  gable_house_edge_gutter?: 'house' | 'our';
  gable_outer_edge_gutter?: 'house' | 'our';
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
  flashings: FlashingNormalizedV1;

  travel_ex_gst: number;
  extras_allowance_ex_gst: number;
  timber_roof_allowance_ex_gst: number;
  timber_roof_above_type: TimberRoofAboveType;
  timber_insulated_panel_thickness_mm: number;
  timber_tray_width_mm: number;
  infills?: InfillInputV1[];

  quote_discount_pct: number;
};

export type RafterCutLengthDeductionV1 = {
  id: 'house_edge' | 'outer_edge' | 'ridge' | 'edge_allowances';
  label: string;
  value_m: number;
};

export type RafterCutLengthPlaneExplanationV1 = {
  id: 'single' | 'house' | 'outer' | 'common';
  label: string;
  diagram_side: 'single' | 'left' | 'right' | 'both';
  base_projected_run_m: number;
  deductions: RafterCutLengthDeductionV1[];
  effective_projected_run_m: number;
  sloped_length_before_allowance_m: number;
  angle_cut_allowance_m: number;
  cut_length_m: number;
};

export type RafterCutLengthExplanationV1 = {
  version: 1;
  status: 'ready' | 'invalid_input' | 'unsupported_roof';
  source: '@sp/costing/engine/rafter-takeoff-v1';
  roof_type: RoofType;
  entered_span_m: number;
  pitch_deg_used: number;
  rafter_profile: RafterProfile;
  rafter_count: number;
  formula: 'cut length = effective projected run / cos(pitch) + angle-cut allowance';
  rounding: {
    display_increment_mm: 1;
    method: 'nearest';
    engine_values: 'unrounded';
  };
  planes: RafterCutLengthPlaneExplanationV1[];
  assumptions: string[];
  unavailable_reason?: string;
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
  sp_gutter_run_count?: number;
  downpipe_join_count_used?: number;
  downpipe_elbow_count_used?: number;
  separate_gutter_enabled?: boolean;
  separate_gutter_length_m?: number;
  ledger_profile_used?: string;
  has_ledger?: boolean;
  ledger_length_m?: number;
  front_beam_length_m?: number;
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
  rafter_clear_len_mm?: number;
  rafter_spacing_mm?: number;
  attachment_length_m?: number;
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
  // Gable/low_gable: per-side rafter cut lengths (slope lengths)
  rafter_cut_length_house_side_m?: number;
  rafter_cut_length_outer_side_m?: number;
  // Optional debug helpers (safe to expose)
  rafter_run_house_side_m?: number;
  rafter_run_outer_side_m?: number;
  rafter_ridge_half_m?: number;
  rafter_house_allowance_m?: number;
  rafter_far_allowance_m?: number;
  rafter_cut_length_explanation?: RafterCutLengthExplanationV1;
  hip_rafter_cut_length_m?: number;
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
  total_installed_rafter_length_m: number;
  joiner_runs_total: number;
  acrylic_joiner_bottom_total_m?: number;
  acrylic_joiner_top_total_m?: number;
  acrylic_joiner_bottom_fixings_each?: number;
  acrylic_install_area_m2?: number;
  infill_instance_count?: number;
  infill_joiner_total_m?: number;
  infill_joiner_fixings_each?: number;
  infill_sheet_area_m2?: number;
  infill_strip_panel_count?: number;
  infill_extra_supports_each?: number;
  flashing_0_200_total_m?: number;
  flashing_201_300_total_m?: number;
  flashing_301_400_total_m?: number;
  flashing_total_m?: number;
  flashing_startup_count?: number;
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

export type TrustedBreakdownOwnerV1 = {
  scope: 'job' | 'pergola' | 'module' | 'unknown';
  label: string;
};

export type TrustedBreakdownFactV1 = {
  label: string;
  value: string | number;
  unit?: string;
};

export type TrustedQuantityExplanationV1 = {
  version: 1;
  source: '@sp/costing/materials-v1' | '@sp/costing/install-actions-v1';
  summary: string;
  facts: TrustedBreakdownFactV1[];
  assumptions: string[];
  rounding?: string;
};

export type TrustedMaterialBreakdownRowV1 = {
  instance_id: string;
  id: string;
  label: string;
  owner: TrustedBreakdownOwnerV1;
  quantity: number;
  unit: string;
  profile?: string | null;
  internal_cost_ex_gst: number;
  explanation?: TrustedQuantityExplanationV1;
};

export type TrustedMaterialBreakdownGroupV1 = {
  id: string;
  label: string;
  rows: TrustedMaterialBreakdownRowV1[];
};

export type TrustedMaterialsBreakdownV1 = {
  version: 1;
  status: 'ready' | 'empty';
  source: '@sp/costing/materials-v1';
  scope: 'whole_job';
  row_count: number;
  groups: TrustedMaterialBreakdownGroupV1[];
  assumptions: string[];
};

export type MaterialsTotalsV1 = {
  materials_ex_gst: number;
  waste_m_by_profile: Record<string, number>;
  bars_by_profile: Record<string, { stock_length_m: number; bars_used: number }>;
  waste_m_by_cut_group?: Record<string, number>;
  bars_by_cut_group?: Record<string, { stock_length_m: number; bars_used: number }>;
};

export type MaterialsV1 = {
  lines: MaterialsLineV1[];
  totals: MaterialsTotalsV1;
  trusted_breakdown?: TrustedMaterialsBreakdownV1;
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

export type TrustedLabourBreakdownRowV1 = {
  instance_id: string;
  id: string;
  label: string;
  owner: TrustedBreakdownOwnerV1;
  quantity: number;
  unit: string;
  minutes: number;
  crew_hours: number;
  internal_cost_ex_gst: number;
  relevant_multipliers: Array<{
    id: string;
    label: string;
    factor: number;
  }>;
  explanation: TrustedQuantityExplanationV1;
};

export type TrustedLabourBreakdownGroupV1 = {
  id: string;
  label: string;
  crew_minutes: number;
  crew_hours: number;
  rows: TrustedLabourBreakdownRowV1[];
};

export type TrustedLabourBreakdownV1 = {
  version: 1;
  status: 'ready' | 'empty';
  source: '@sp/costing/install-actions-v1';
  scope: 'whole_job';
  action_count: number;
  total_crew_minutes: number;
  total_crew_hours: number;
  groups: TrustedLabourBreakdownGroupV1[];
  assumptions: string[];
};

export type InstallTotalsV1 = {
  crew_minutes: number;
  crew_hours: number;
  install_ex_gst: number;
};

export type InstallV1 = {
  actions: InstallActionV1[];
  totals: InstallTotalsV1;
  trusted_breakdown?: TrustedLabourBreakdownV1;
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
  infill_takeoff?: InfillTakeoffV1;
};

export type JobInputsV1 = {
  modules: CostInputsV1[];
  job_type?: JobType;
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
  infill_takeoff?: InfillTakeoffV1;
};

export type PergolaInputsV1 = {
  id?: string;
  label?: string;
  modules: CostInputsV1[];
};

export type SiteInputsV1 = {
  pergolas: PergolaInputsV1[];
  job_type?: JobType;
  pricing_classification?: import('../commercial/simpleRangePricing').PricingClassificationV2;
  approval_requirement?: import('../commercial/simpleRangePricing').ApprovalRequirementV2;
  travel_ex_gst?: number;
  extras_allowance_ex_gst?: number;
  quote_discount_pct?: number;
};

export type PergolaOutputV1 = {
  id: string;
  label?: string;
  module_count: number;
  modules: CostOutputV1[];
  materials: MaterialsV1;
  install: InstallV1;
  overhead: OverheadV1;
  totals: TotalsV1;
  infill_takeoff?: InfillTakeoffV1;
  infill_cost_breakdown?: InfillCostBreakdownV1 | InfillCostBreakdownV2;
};

export type SiteSharedOutputV1 = {
  install: InstallV1;
  add_ons: AddOnsV1;
  totals: TotalsV1;
};

export type SiteOutputV1 = {
  pergola_count: number;
  pergolas: PergolaOutputV1[];
  shared: SiteSharedOutputV1;
  materials: MaterialsV1;
  install: InstallV1;
  overhead: OverheadV1;
  add_ons: AddOnsV1;
  totals: TotalsV1;
  pricing_policy?: import('../commercial/simpleRangePricing').SitePricingPolicyV2;
  customer_add_ons?: {
    approval: import('../commercial/simpleRangePricing').ApprovalCustomerAllowanceV2 | null;
  };
  infill_takeoff?: InfillTakeoffV1;
};

// ============================================================================
// V2 — scene-derived cost input (PR-2B.3, 2026-05-22)
// ============================================================================
//
// Phase 2 north star (locked 2026-05-22): the cost engine receives PERGOLA
// data only (plus future pergola accessories — blinds, lights, etc.). House
// forms, decks, openings exist in the scene for design but are NOT costed.
//
// Logical pergola grouping (which pergola objects belong to one pergola vs.
// stand alone) is derived from spatial adjacency in the workbench scene:
// pergolas snapped to each other are modules of one logical pergola;
// unsnapped pergolas are separate. The workbench builder
// (`buildSiteInputsV2FromScene`) does this derivation via
// `derivePergolaGroupsFromScene` (PR-2B.2). The shape below is the contract
// the cost engine accepts.
//
// Differences from V1:
// - No `houseContext`, no `decks`, no `openings` fields anywhere. Those are
//   workbench-scene data the cost engine doesn't read (confirmed in PR-G3a
//   investigation; cost engine reads only pergola-shape fields).
// - `access`, `height` lift to site-level (they're per-job, never varied per
//   pergola in practice).
// - Each logical pergola exposes an `accessories[]` slot for future blinds,
//   lights, etc. Empty union for now — extensible without contract churn.
// - Module grouping is scene-derived, not driven by a stored `pergolaId`
//   field on the calculator inputs.

/**
 * Future-proofed accessory slot. Empty union for now — populated when the
 * first pergola accessory (blinds, lights, etc.) lands. Cost engine accepts
 * the empty array as a no-op pass-through; pricing logic stays out of the
 * way until a concrete accessory type ships.
 */
export type PergolaAccessoryV2 = never;

/**
 * Per-physical-module pergola cost fields. Mirrors the pergola-only subset
 * of `CostInputsV1`. Each module is one `PergolaObjectModel` in the scene;
 * modules of the same logical pergola are snapped to each other.
 *
 * `access`, `height`, `travel_ex_gst`, `extras_allowance_ex_gst`,
 * `quote_discount_pct`, `job_type` lift to `SiteInputsV2` (site-level).
 */
export type PergolaModuleCostInputV2 = {
  /** Stable id from the scene's `PergolaObjectModel.id`. */
  id: string;

  length_m: number;
  roof_span_m?: number;
  projection_m?: number;
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
  flashings?: FlashingInputsV1;

  post_count?: number;
  house_connection_type: HouseConnectionType;
  /**
   * Length of the pergola edge that meets the host wall (mm). When
   * `null`/`undefined`, defaults to `length_m * 1000` (the long side —
   * legacy `attachment_side: 'rear' | 'front'` behavior). Workbench
   * derives this from the snap-attached edge length.
   */
  attachment_length_mm?: number | null;
  post_connection_type: PostConnectionType;
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
  gable_house_edge_gutter?: 'house' | 'our';
  gable_outer_edge_gutter?: 'house' | 'our';
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

  timber_roof_above_type?: TimberRoofAboveType;
  timber_insulated_panel_thickness_mm?: number;
  timber_tray_width_mm?: number;
  timber_roof_allowance_ex_gst?: number;
  infills?: InfillInputV1[];
};

/**
 * One logical pergola — one or more physical modules snapped together in
 * the scene, plus future accessory slots. Derived from the scene by the
 * workbench builder; cost engine treats this as the unit it prices.
 */
export type PergolaInputsV2 = {
  /** Logical-pergola id, stable across runs (from `PergolaGroup.pergolaId`). */
  id: string;
  /** Display label (commonly the first member's label). */
  label?: string;
  /** Physical pergola modules connected to each other via snap-derived adjacency. */
  modules: PergolaModuleCostInputV2[];
  /**
   * Pergola-attached accessories (blinds, lights, awnings, etc.). Empty
   * for now; the slot exists so the cost engine contract is forward-
   * compatible without future churn.
   */
  accessories: PergolaAccessoryV2[];
};

/**
 * Scene-derived cost input. Replaces `SiteInputsV1` for the workbench cost
 * path. Marketing form path keeps `SiteInputsV1` (per Phase 2 plan Q5
 * "Marketing path stays independent").
 */
export type SiteInputsV2 = {
  schema_version: 'v2';
  pergolas: PergolaInputsV2[];
  job_type?: JobType;
  access: AccessLevel;
  height: HeightCategory;
  travel_ex_gst?: number;
  extras_allowance_ex_gst?: number;
  quote_discount_pct?: number;
};
