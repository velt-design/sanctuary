import type { WorkbenchDebugFixtureExport } from './workbenchDebugExport';

export const CAPTURED_HOUSE_ROOF_FAILURE_20260602_PAYLOAD = {
  "snapshot": {
    "inputs": {
      "access": "normal",
      "blinds": {
        "items": []
      },
      "height": "single_storey",
      "jobType": "commercial",
      "modules": [
        {
          "ground": "easy",
          "infills": {
            "items": []
          },
          "lengthM": "3.95",
          "flashings": {
            "rows": [
              {
                "id": "e6868558-285a-4efe-bc55-02490d6b2b6d",
                "band": "201-300",
                "kind": "primary",
                "lengthM": "3.95",
                "purpose": "CUSTOM"
              },
              {
                "id": "b71195b4-5d19-4417-a819-1edfa34b8e13",
                "band": "201-300",
                "kind": "extra",
                "lengthM": "4.75",
                "purpose": "CUSTOM"
              },
              {
                "id": "7d6b0632-e637-4702-9970-4af3df20b77c",
                "band": "201-300",
                "kind": "extra",
                "lengthM": "4.75",
                "purpose": "CUSTOM"
              },
              {
                "id": "81622164-2413-4d34-b790-cadde5692d49",
                "band": "201-300",
                "kind": "extra",
                "lengthM": "4.1",
                "purpose": "CUSTOM"
              }
            ]
          },
          "overrides": {},
          "pergolaId": "pergola-1",
          "postCount": "2",
          "projectionM": "4.75",
          "pergolaStyle": "pitched",
          "roofMaterial": "acrylic",
          "roofPitchDeg": "10",
          "downpipeCount": "0",
          "attachmentSide": "rear",
          "fallDistanceMm": "0",
          "postCutHeightM": "2.4",
          "extrusionColour": "Black",
          "invertedEnabled": false,
          "overhangAmountM": "0.2",
          "overhangEnabled": false,
          "boxGutterFarEdge": "our",
          "internalRoofType": "pitched",
          "downpipeJoinCount": "0",
          "hipCornerLengthBM": "0",
          "mixedAcrylicBaysA": "",
          "mixedAcrylicBaysB": "",
          "timberTrayWidthMm": "500",
          "boxGutterHouseEdge": "house",
          "downpipeElbowCount": "0",
          "gableEndFramesMode": "outer_end_only",
          "houseFootprintMode": "preset",
          "postConnectionType": "deck_bracket",
          "powdercoatIsCustom": false,
          "boxPerimeterEnabled": false,
          "houseConnectionType": "soffit",
          "invertedHouseGutter": true,
          "timberRoofAboveType": "insulated_panels",
          "gableHouseEdgeGutter": "house",
          "gableOuterEdgeGutter": "our",
          "houseFootprintParams": {
            "widthM": "",
            "offsetXM": "0",
            "setbackM": "0",
            "sideRunM": "2.4",
            "bandDepthM": "1.8",
            "returnRunM": "2.4",
            "leftLegRunM": "2.4",
            "recessDepthM": "1.2",
            "recessWidthM": "2.4",
            "rightLegRunM": "2.4"
          },
          "houseFootprintPreset": "straight",
          "mixedAcrylicBaysMain": "",
          "hipCornerProjectionBM": "0",
          "houseFootprintPolygon": [],
          "separateGutterEnabled": false,
          "powdercoatCustomColour": "",
          "mixedSkylightStripCount": "1",
          "mixedSkylightStripWidthM": "0.62",
          "powdercoatStandardColour": "",
          "timberRoofAllowanceExGst": "0",
          "overhangSupportBeamProfile": "150x50",
          "drawingRotationQuarterTurns": 0,
          "timberInsulatedPanelThicknessMm": "50"
        }
      ],
      "pergolas": [
        {
          "id": "pergola-1",
          "label": "Pergola 1"
        }
      ],
      "quoteRef": "",
      "projectName": "Test",
      "travelExGst": "3000",
      "schemaVersion": "v2",
      "quoteDiscountPct": "0",
      "extrasAllowanceExGst": "1000"
    },
    "outputs": {
      "shared": {
        "totals": {
          "warnings": [],
          "cost_ex_gst": 4822.5,
          "cost_inc_gst": 5545.88,
          "notes_and_warnings": []
        },
        "add_ons": {
          "travel_ex_gst": 3000,
          "extras_allowance_ex_gst": 1000
        },
        "install": {
          "totals": {
            "crew_hours": 10.97,
            "crew_minutes": 658,
            "install_ex_gst": 822.5
          },
          "actions": [
            {
              "id": "job.day_cycle.daily_tidy",
              "qty": 5,
              "unit": "day",
              "label": "[Job] Daily tidy up",
              "scope": "job",
              "minutes": 90,
              "category": "Mobilisation",
              "cost_ex_gst": 112.5,
              "applied_multipliers": {
                "access": 1,
                "height": 1
              }
            },
            {
              "id": "job.day_cycle.pack_down_tools",
              "qty": 5,
              "unit": "day",
              "label": "[Job] Daily pack down / tool load-out",
              "scope": "job",
              "minutes": 150,
              "category": "Mobilisation",
              "cost_ex_gst": 187.5,
              "applied_multipliers": {
                "access": 1,
                "height": 1
              }
            },
            {
              "id": "job.day_cycle.setup_tools",
              "qty": 5,
              "unit": "day",
              "label": "[Job] Daily setup / tool unload & staging",
              "scope": "job",
              "minutes": 150,
              "category": "Mobilisation",
              "cost_ex_gst": 187.5,
              "applied_multipliers": {
                "access": 1,
                "height": 1
              }
            },
            {
              "id": "job.drain.gutter_startup_job",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Gutter startup (end caps + droppers/outlets)",
              "scope": "job",
              "minutes": 36,
              "category": "Drainage",
              "cost_ex_gst": 45,
              "applied_multipliers": {
                "access": 1,
                "height": 1
              }
            },
            {
              "id": "job.mob.client_briefing",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Client briefing / confirm scope on arrival",
              "scope": "job",
              "minutes": 15,
              "category": "Mobilisation",
              "cost_ex_gst": 18.75,
              "applied_multipliers": {
                "access": 1
              }
            },
            {
              "id": "job.mob.offload_materials",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Materials offloaded & staged",
              "scope": "job",
              "minutes": 10,
              "category": "Mobilisation",
              "cost_ex_gst": 12.5,
              "applied_multipliers": {
                "access_logistics": 1
              }
            },
            {
              "id": "job.mob.scaffolding_startup",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Scaffolding setup, packdown and load labour",
              "scope": "job",
              "minutes": 150,
              "category": "Mob",
              "cost_ex_gst": 187.5,
              "applied_multipliers": {}
            },
            {
              "id": "job.mob.site_safety",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Site safety checklist / toolbox talk",
              "scope": "job",
              "minutes": 15,
              "category": "Mobilisation",
              "cost_ex_gst": 18.75,
              "applied_multipliers": {}
            },
            {
              "id": "job.mob.site_survey",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Site survey / set-out verification",
              "scope": "job",
              "minutes": 18,
              "category": "Mobilisation",
              "cost_ex_gst": 22.5,
              "applied_multipliers": {
                "access": 1
              }
            },
            {
              "id": "job.mob.tool_setup",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Tool setup & staging",
              "scope": "job",
              "minutes": 24,
              "category": "Mobilisation",
              "cost_ex_gst": 30,
              "applied_multipliers": {}
            }
          ]
        }
      },
      "totals": {
        "warnings": [],
        "cost_ex_gst": 16962.29,
        "cost_inc_gst": 19506.63,
        "notes_and_warnings": []
      },
      "derived": {
        "area_m2": 18.7625,
        "length_m": 3.95,
        "bay_count": 7,
        "site_days": 5,
        "has_ledger": true,
        "gutter_mode": "default",
        "roof_planes": [
          {
            "id": "main",
            "label": "Main",
            "bay_count": 7,
            "roof_area_m2": 19.05194180550629,
            "rafter_length_m": 4.823276406457289
          }
        ],
        "roof_span_m": 4.75,
        "module_count": 1,
        "projection_m": 4.75,
        "rafter_count": 8,
        "rafter_run_m": 4.75,
        "bracket_count": 4,
        "roof_length_m": 3.95,
        "has_our_gutter": true,
        "ridge_length_m": 0,
        "timber_area_m2": 0,
        "acrylic_area_m2": 19.05194180550629,
        "effective_run_m": 4.6,
        "gutter_length_m": 3.95,
        "ledger_length_m": 3.95,
        "rafter_length_m": 4.823276406457289,
        "slope_direction": "away_from_house",
        "covertek_area_m2": 20.95713598605692,
        "flashing_total_m": 17.549999999999997,
        "hip_rafter_count": 0,
        "inverted_enabled": false,
        "overhang_enabled": false,
        "roof_plane_count": 1,
        "joiner_runs_total": 8,
        "overhang_amount_m": 0,
        "post_profile_used": "100x100",
        "rafter_spacing_mm": 557.1428571428571,
        "roof_plane_span_m": 4.75,
        "splice_join_count": 8,
        "tie_beam_length_m": 4.6000000000000005,
        "acrylic_bays_total": 7,
        "roof_area_total_m2": 18.7625,
        "roof_slope_area_m2": 19.05194180550629,
        "strut_profile_used": "50x50",
        "timber_plane_count": 1,
        "total_roof_area_m2": 19.05194180550629,
        "attachment_length_m": 3.95,
        "cut_rafter_length_m": 4.697411461780697,
        "front_beam_length_m": 0,
        "ledger_profile_used": "150x50",
        "our_gutter_length_m": 3.95,
        "polystyrene_area_m2": 19.05194180550629,
        "rafter_clear_len_mm": 3900,
        "rafter_cut_length_m": 4.697411461780697,
        "rafter_profile_auto": "150x50",
        "roof_pitch_deg_used": 10,
        "sp_gutter_run_count": 1,
        "total_rafter_pieces": 8,
        "visible_finish_used": "default",
        "gutter_assembly_mode": "integrated",
        "infill_sheet_area_m2": 0,
        "rafter_run_m_takeoff": 4.6000000000000005,
        "required_downslope_m": 4.690962414674426,
        "roof_surface_area_m2": 19.05194180550629,
        "timber_hidden_finish": "mill",
        "angle_cut_allowance_m": 0.026449047106269746,
        "gable_end_frame_count": 0,
        "house_gutter_length_m": 0,
        "infill_instance_count": 0,
        "infill_joiner_total_m": 0,
        "inverted_house_gutter": false,
        "joiner_piece_length_m": 4.690962414674426,
        "powdercoat_multiplier": null,
        "stringer_fixing_count": 0,
        "tie_beam_profile_used": "150x50",
        "timber_purlin_total_m": 43.45,
        "flashing_0_200_total_m": 0,
        "flashing_startup_count": 1,
        "integrated_gutter_beam": true,
        "overhang_end_cap_count": 0,
        "powdercoat_colour_used": null,
        "rafter_far_allowance_m": 0.1,
        "timber_run_per_plane_m": 4.75,
        "acrylic_install_area_m2": 19.05,
        "front_beam_profile_used": "SP Gutter",
        "kingpost_strut_length_m": 0.4187765791826043,
        "rafter_length_m_assumed": 4.823276406457289,
        "ridge_beam_profile_used": null,
        "separate_gutter_enabled": false,
        "acrylic_plane_count_used": 0,
        "downpipe_join_count_used": 0,
        "flashing_201_300_total_m": 17.549999999999997,
        "flashing_301_400_total_m": 0,
        "infill_strip_panel_count": 0,
        "rafter_house_allowance_m": 0.05,
        "separate_gutter_length_m": 0,
        "downpipe_elbow_count_used": 0,
        "ledger_underside_height_m": 2.4,
        "timber_roof_above_area_m2": 19.05194180550629,
        "acrylic_joiner_top_total_m": 37.53,
        "infill_extra_supports_each": 0,
        "infill_joiner_fixings_each": 0,
        "overhang_stringer_length_m": 0,
        "acrylic_required_downslope_m": 4.690962414674426,
        "post_cut_height_house_side_m": 2.4,
        "post_cut_height_outer_side_m": 1.5888958887410611,
        "timber_slope_len_per_plane_m": 4.823276406457289,
        "acrylic_joiner_bottom_total_m": 37.53,
        "roof_plane_sloped_downslope_m": 4.823276406457289,
        "timber_purlin_lines_per_plane": 11,
        "timber_tray_sheet_count_total": 8,
        "overhang_stringer_profile_used": null,
        "overhang_support_beam_length_m": 0,
        "timber_edge_rafter_count_total": 2,
        "timber_edge_rafter_finish_used": "default",
        "box_perimeter_beam_profile_used": null,
        "timber_edge_rafter_profile_used": "150x50",
        "total_installed_rafter_length_m": 37.579291694245576,
        "timber_common_rafter_count_total": 9,
        "timber_roofing_screws_steel_count": 115,
        "timber_tray_sheet_count_per_plane": 8,
        "acrylic_joiner_bottom_fixings_each": 136,
        "overhang_support_beam_profile_used": null,
        "timber_edge_rafter_count_per_plane": 2,
        "timber_insulated_panel_count_total": 4,
        "timber_common_rafter_count_per_plane": 9,
        "timber_roofing_screws_insulated_count": 77,
        "timber_insulated_panel_count_per_plane": 4
      },
      "install": {
        "totals": {
          "crew_hours": 35.87,
          "crew_minutes": 2152.31,
          "install_ex_gst": 2690.41
        },
        "actions": [
          {
            "id": "job.day_cycle.daily_tidy",
            "qty": 5,
            "unit": "day",
            "label": "[Job] Daily tidy up",
            "scope": "job",
            "minutes": 90,
            "category": "Mobilisation",
            "cost_ex_gst": 112.5,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "job.day_cycle.pack_down_tools",
            "qty": 5,
            "unit": "day",
            "label": "[Job] Daily pack down / tool load-out",
            "scope": "job",
            "minutes": 150,
            "category": "Mobilisation",
            "cost_ex_gst": 187.5,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "job.day_cycle.setup_tools",
            "qty": 5,
            "unit": "day",
            "label": "[Job] Daily setup / tool unload & staging",
            "scope": "job",
            "minutes": 150,
            "category": "Mobilisation",
            "cost_ex_gst": 187.5,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "job.drain.gutter_startup_job",
            "qty": 1,
            "unit": "job",
            "label": "[Job] Gutter startup (end caps + droppers/outlets)",
            "scope": "job",
            "minutes": 36,
            "category": "Drainage",
            "cost_ex_gst": 45,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "job.mob.client_briefing",
            "qty": 1,
            "unit": "job",
            "label": "[Job] Client briefing / confirm scope on arrival",
            "scope": "job",
            "minutes": 15,
            "category": "Mobilisation",
            "cost_ex_gst": 18.75,
            "applied_multipliers": {
              "access": 1
            }
          },
          {
            "id": "job.mob.offload_materials",
            "qty": 1,
            "unit": "job",
            "label": "[Job] Materials offloaded & staged",
            "scope": "job",
            "minutes": 10,
            "category": "Mobilisation",
            "cost_ex_gst": 12.5,
            "applied_multipliers": {
              "access_logistics": 1
            }
          },
          {
            "id": "job.mob.scaffolding_startup",
            "qty": 1,
            "unit": "job",
            "label": "[Job] Scaffolding setup, packdown and load labour",
            "scope": "job",
            "minutes": 150,
            "category": "Mob",
            "cost_ex_gst": 187.5,
            "applied_multipliers": {}
          },
          {
            "id": "job.mob.site_safety",
            "qty": 1,
            "unit": "job",
            "label": "[Job] Site safety checklist / toolbox talk",
            "scope": "job",
            "minutes": 15,
            "category": "Mobilisation",
            "cost_ex_gst": 18.75,
            "applied_multipliers": {}
          },
          {
            "id": "job.mob.site_survey",
            "qty": 1,
            "unit": "job",
            "label": "[Job] Site survey / set-out verification",
            "scope": "job",
            "minutes": 18,
            "category": "Mobilisation",
            "cost_ex_gst": 22.5,
            "applied_multipliers": {
              "access": 1
            }
          },
          {
            "id": "job.mob.tool_setup",
            "qty": 1,
            "unit": "job",
            "label": "[Job] Tool setup & staging",
            "scope": "job",
            "minutes": 24,
            "category": "Mobilisation",
            "cost_ex_gst": 30,
            "applied_multipliers": {}
          },
          {
            "id": "m1.demob.pack_down",
            "qty": 1,
            "unit": "job",
            "label": "[Pergola 1 M1] Pack down tools and load out",
            "scope": "module",
            "minutes": 30,
            "category": "Demobilisation",
            "cost_ex_gst": 37.5,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.demob.rubbish",
            "qty": 1,
            "unit": "job",
            "label": "[Pergola 1 M1] Rubbish removal (basic)",
            "scope": "module",
            "minutes": 60,
            "category": "Demobilisation",
            "cost_ex_gst": 75,
            "applied_multipliers": {
              "access": 1
            }
          },
          {
            "id": "m1.drain.install_downpipe",
            "qty": 1,
            "unit": "each",
            "label": "[Pergola 1 M1] Install downpipe (cut/fit/fasten) - each",
            "scope": "module",
            "minutes": 30,
            "category": "Drainage",
            "cost_ex_gst": 37.5,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.finish.client_handover",
            "qty": 1,
            "unit": "job",
            "label": "[Pergola 1 M1] Client walkthrough / handover",
            "scope": "module",
            "minutes": 12,
            "category": "Finishing",
            "cost_ex_gst": 15,
            "applied_multipliers": {}
          },
          {
            "id": "m1.finish.final_clean",
            "qty": 1,
            "unit": "job",
            "label": "[Pergola 1 M1] Final clean and site tidy",
            "scope": "module",
            "minutes": 45,
            "category": "Finishing",
            "cost_ex_gst": 56.25,
            "applied_multipliers": {
              "access": 1
            }
          },
          {
            "id": "m1.finish.touchups",
            "qty": 1,
            "unit": "job",
            "label": "[Pergola 1 M1] Touch-ups / sealant / final adjustments",
            "scope": "module",
            "minutes": 24,
            "category": "Finishing",
            "cost_ex_gst": 30,
            "applied_multipliers": {
              "access": 1
            }
          },
          {
            "id": "m1.frame.front_beam_sp_gutter_install_m",
            "qty": 3.95,
            "unit": "metre",
            "label": "[Pergola 1 M1] Install SP gutter run - per metre",
            "scope": "module",
            "minutes": 37.92,
            "category": "Frame",
            "cost_ex_gst": 47.4,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.frame.house_stringer_install_m",
            "qty": 3.95,
            "unit": "metre",
            "label": "[Pergola 1 M1] Install house-side stringer (default 100x50) - per metre",
            "scope": "module",
            "minutes": 28.44,
            "category": "Frame",
            "cost_ex_gst": 35.55,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.frame.square_level_frame",
            "qty": 1,
            "unit": "job",
            "label": "[Pergola 1 M1] Square/level main frame & confirm falls",
            "scope": "module",
            "minutes": 30,
            "category": "Frame",
            "cost_ex_gst": 37.5,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.house.install_back_stringer_startup",
            "qty": 1,
            "unit": "module",
            "label": "[Pergola 1 M1] Install back stringer (startup)",
            "scope": "module",
            "minutes": 20,
            "category": "House Connection",
            "cost_ex_gst": 25,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.house.install_soffit_bracket",
            "qty": 4,
            "unit": "bracket",
            "label": "[Pergola 1 M1] Install soffit bracket (each)",
            "scope": "module",
            "minutes": 96,
            "category": "House Connection",
            "cost_ex_gst": 120,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.join.splice_join_each",
            "qty": 8,
            "unit": "each",
            "label": "[Pergola 1 M1] Install splice join (bracket + screws)",
            "scope": "module",
            "minutes": 96,
            "category": "Joinery",
            "cost_ex_gst": 120,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.posts.deck_bracket_per_post",
            "qty": 2,
            "unit": "post",
            "label": "[Pergola 1 M1] Post to deck bracket connection (install + plumb)",
            "scope": "module",
            "minutes": 30,
            "category": "Posts & Footings",
            "cost_ex_gst": 37.5,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.rafters.install_rafter_pitched",
            "qty": 8,
            "unit": "rafter",
            "label": "[Pergola 1 M1] Cut + install rafter (pitched roof) - per rafter",
            "scope": "module",
            "minutes": 172.96,
            "category": "Rafters",
            "cost_ex_gst": 216.2,
            "applied_multipliers": {
              "access": 1,
              "height": 1,
              "roof_type": 1,
              "structure_type": 1,
              "pitch_steep_roof": 1,
              "rafter_length_multiplier": 1.13
            }
          },
          {
            "id": "m1.rafters.rafter_length_loading_m",
            "qty": 37.579291694245576,
            "unit": "metre",
            "label": "[Pergola 1 M1] Additional rafter labour loading - per installed metre",
            "scope": "module",
            "minutes": 198.19,
            "category": "Rafters",
            "cost_ex_gst": 247.74,
            "applied_multipliers": {
              "access": 1,
              "height": 1,
              "roof_type": 1,
              "structure_type": 1,
              "pitch_steep_roof": 1,
              "rafter_length_loading_curve": 4.39
            }
          },
          {
            "id": "m1.roof.apply_foam_seal_m",
            "qty": 3.95,
            "unit": "metre",
            "label": "[Pergola 1 M1] Apply foam/weather seal - per metre",
            "scope": "module",
            "minutes": 4.74,
            "category": "Roof",
            "cost_ex_gst": 5.93,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.roof.fix_joiner_bottom_each",
            "qty": 136,
            "unit": "each",
            "label": "[Pergola 1 M1] Fix bottom joiner to rafters - each fixing",
            "scope": "module",
            "minutes": 81.6,
            "category": "Roof",
            "cost_ex_gst": 102,
            "applied_multipliers": {
              "access": 1,
              "height": 1,
              "roof_type": 1,
              "pitch_steep_roof": 1
            }
          },
          {
            "id": "m1.roof.flashing_startup",
            "qty": 1,
            "unit": "module",
            "label": "[Pergola 1 M1] Flashing setup/startup - per module",
            "scope": "module",
            "minutes": 36,
            "category": "Roof",
            "cost_ex_gst": 45,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.roof.install_acrylic_panels_m2",
            "qty": 19.05,
            "unit": "m2",
            "label": "[Pergola 1 M1] Install acrylic panels - per m²",
            "scope": "module",
            "minutes": 114.3,
            "category": "Roof",
            "cost_ex_gst": 142.88,
            "applied_multipliers": {
              "access": 1,
              "height": 1,
              "roof_type": 1,
              "pitch_steep_roof": 1
            }
          },
          {
            "id": "m1.roof.install_flashing_201_300_m",
            "qty": 17.549999999999997,
            "unit": "metre",
            "label": "[Pergola 1 M1] Install flashing 201-300mm - per metre",
            "scope": "module",
            "minutes": 189.54,
            "category": "Roof",
            "cost_ex_gst": 236.93,
            "applied_multipliers": {
              "access": 1,
              "height": 1
            }
          },
          {
            "id": "m1.roof.install_joiner_bottom_m",
            "qty": 37.53,
            "unit": "metre",
            "label": "[Pergola 1 M1] Install bottom joiner - per metre",
            "scope": "module",
            "minutes": 90.07,
            "category": "Roof",
            "cost_ex_gst": 112.59,
            "applied_multipliers": {
              "access": 1,
              "height": 1,
              "roof_type": 1,
              "pitch_steep_roof": 1
            }
          },
          {
            "id": "m1.roof.install_joiner_top_m",
            "qty": 37.53,
            "unit": "metre",
            "label": "[Pergola 1 M1] Install top joiner (no fixings) - per metre",
            "scope": "module",
            "minutes": 67.55,
            "category": "Roof",
            "cost_ex_gst": 84.44,
            "applied_multipliers": {
              "access": 1,
              "height": 1,
              "roof_type": 1,
              "pitch_steep_roof": 1
            }
          }
        ]
      },
      "version": 1,
      "overhead": {
        "method": "fixed_plus_variable",
        "ops_ex_gst": 3613.75,
        "sales_ex_gst": 1517.86,
        "total_ex_gst": 5131.61
      },
      "pergolas": [
        {
          "id": "pergola-1",
          "label": "Pergola 1",
          "totals": {
            "warnings": [],
            "cost_ex_gst": 12139.79,
            "cost_inc_gst": 13960.76,
            "notes_and_warnings": []
          },
          "install": {
            "totals": {
              "crew_hours": 24.91,
              "crew_minutes": 1494.31,
              "install_ex_gst": 1867.91
            },
            "actions": [
              {
                "id": "m1.demob.pack_down",
                "qty": 1,
                "unit": "job",
                "label": "[M1] Pack down tools and load out",
                "scope": "module",
                "minutes": 30,
                "category": "Demobilisation",
                "cost_ex_gst": 37.5,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.demob.rubbish",
                "qty": 1,
                "unit": "job",
                "label": "[M1] Rubbish removal (basic)",
                "scope": "module",
                "minutes": 60,
                "category": "Demobilisation",
                "cost_ex_gst": 75,
                "applied_multipliers": {
                  "access": 1
                }
              },
              {
                "id": "m1.drain.install_downpipe",
                "qty": 1,
                "unit": "each",
                "label": "[M1] Install downpipe (cut/fit/fasten) - each",
                "scope": "module",
                "minutes": 30,
                "category": "Drainage",
                "cost_ex_gst": 37.5,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.finish.client_handover",
                "qty": 1,
                "unit": "job",
                "label": "[M1] Client walkthrough / handover",
                "scope": "module",
                "minutes": 12,
                "category": "Finishing",
                "cost_ex_gst": 15,
                "applied_multipliers": {}
              },
              {
                "id": "m1.finish.final_clean",
                "qty": 1,
                "unit": "job",
                "label": "[M1] Final clean and site tidy",
                "scope": "module",
                "minutes": 45,
                "category": "Finishing",
                "cost_ex_gst": 56.25,
                "applied_multipliers": {
                  "access": 1
                }
              },
              {
                "id": "m1.finish.touchups",
                "qty": 1,
                "unit": "job",
                "label": "[M1] Touch-ups / sealant / final adjustments",
                "scope": "module",
                "minutes": 24,
                "category": "Finishing",
                "cost_ex_gst": 30,
                "applied_multipliers": {
                  "access": 1
                }
              },
              {
                "id": "m1.frame.front_beam_sp_gutter_install_m",
                "qty": 3.95,
                "unit": "metre",
                "label": "[M1] Install SP gutter run - per metre",
                "scope": "module",
                "minutes": 37.92,
                "category": "Frame",
                "cost_ex_gst": 47.4,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.frame.house_stringer_install_m",
                "qty": 3.95,
                "unit": "metre",
                "label": "[M1] Install house-side stringer (default 100x50) - per metre",
                "scope": "module",
                "minutes": 28.44,
                "category": "Frame",
                "cost_ex_gst": 35.55,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.frame.square_level_frame",
                "qty": 1,
                "unit": "job",
                "label": "[M1] Square/level main frame & confirm falls",
                "scope": "module",
                "minutes": 30,
                "category": "Frame",
                "cost_ex_gst": 37.5,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.house.install_back_stringer_startup",
                "qty": 1,
                "unit": "module",
                "label": "[M1] Install back stringer (startup)",
                "scope": "module",
                "minutes": 20,
                "category": "House Connection",
                "cost_ex_gst": 25,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.house.install_soffit_bracket",
                "qty": 4,
                "unit": "bracket",
                "label": "[M1] Install soffit bracket (each)",
                "scope": "module",
                "minutes": 96,
                "category": "House Connection",
                "cost_ex_gst": 120,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.join.splice_join_each",
                "qty": 8,
                "unit": "each",
                "label": "[M1] Install splice join (bracket + screws)",
                "scope": "module",
                "minutes": 96,
                "category": "Joinery",
                "cost_ex_gst": 120,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.posts.deck_bracket_per_post",
                "qty": 2,
                "unit": "post",
                "label": "[M1] Post to deck bracket connection (install + plumb)",
                "scope": "module",
                "minutes": 30,
                "category": "Posts & Footings",
                "cost_ex_gst": 37.5,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.rafters.install_rafter_pitched",
                "qty": 8,
                "unit": "rafter",
                "label": "[M1] Cut + install rafter (pitched roof) - per rafter",
                "scope": "module",
                "minutes": 172.96,
                "category": "Rafters",
                "cost_ex_gst": 216.2,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1,
                  "roof_type": 1,
                  "structure_type": 1,
                  "pitch_steep_roof": 1,
                  "rafter_length_multiplier": 1.13
                }
              },
              {
                "id": "m1.rafters.rafter_length_loading_m",
                "qty": 37.579291694245576,
                "unit": "metre",
                "label": "[M1] Additional rafter labour loading - per installed metre",
                "scope": "module",
                "minutes": 198.19,
                "category": "Rafters",
                "cost_ex_gst": 247.74,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1,
                  "roof_type": 1,
                  "structure_type": 1,
                  "pitch_steep_roof": 1,
                  "rafter_length_loading_curve": 4.39
                }
              },
              {
                "id": "m1.roof.apply_foam_seal_m",
                "qty": 3.95,
                "unit": "metre",
                "label": "[M1] Apply foam/weather seal - per metre",
                "scope": "module",
                "minutes": 4.74,
                "category": "Roof",
                "cost_ex_gst": 5.93,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.roof.fix_joiner_bottom_each",
                "qty": 136,
                "unit": "each",
                "label": "[M1] Fix bottom joiner to rafters - each fixing",
                "scope": "module",
                "minutes": 81.6,
                "category": "Roof",
                "cost_ex_gst": 102,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1,
                  "roof_type": 1,
                  "pitch_steep_roof": 1
                }
              },
              {
                "id": "m1.roof.flashing_startup",
                "qty": 1,
                "unit": "module",
                "label": "[M1] Flashing setup/startup - per module",
                "scope": "module",
                "minutes": 36,
                "category": "Roof",
                "cost_ex_gst": 45,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.roof.install_acrylic_panels_m2",
                "qty": 19.05,
                "unit": "m2",
                "label": "[M1] Install acrylic panels - per m²",
                "scope": "module",
                "minutes": 114.3,
                "category": "Roof",
                "cost_ex_gst": 142.88,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1,
                  "roof_type": 1,
                  "pitch_steep_roof": 1
                }
              },
              {
                "id": "m1.roof.install_flashing_201_300_m",
                "qty": 17.549999999999997,
                "unit": "metre",
                "label": "[M1] Install flashing 201-300mm - per metre",
                "scope": "module",
                "minutes": 189.54,
                "category": "Roof",
                "cost_ex_gst": 236.93,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1
                }
              },
              {
                "id": "m1.roof.install_joiner_bottom_m",
                "qty": 37.53,
                "unit": "metre",
                "label": "[M1] Install bottom joiner - per metre",
                "scope": "module",
                "minutes": 90.07,
                "category": "Roof",
                "cost_ex_gst": 112.59,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1,
                  "roof_type": 1,
                  "pitch_steep_roof": 1
                }
              },
              {
                "id": "m1.roof.install_joiner_top_m",
                "qty": 37.53,
                "unit": "metre",
                "label": "[M1] Install top joiner (no fixings) - per metre",
                "scope": "module",
                "minutes": 67.55,
                "category": "Roof",
                "cost_ex_gst": 84.44,
                "applied_multipliers": {
                  "access": 1,
                  "height": 1,
                  "roof_type": 1,
                  "pitch_steep_roof": 1
                }
              }
            ]
          },
          "modules": [
            {
              "totals": {
                "warnings": [],
                "cost_ex_gst": 6508.18,
                "cost_inc_gst": 7484.41,
                "notes_and_warnings": []
              },
              "add_ons": {
                "travel_ex_gst": 0,
                "extras_allowance_ex_gst": 0
              },
              "derived": {
                "area_m2": 18.7625,
                "length_m": 3.95,
                "bay_count": 7,
                "site_days": 5,
                "has_ledger": true,
                "gutter_mode": "default",
                "roof_planes": [
                  {
                    "id": "main",
                    "label": "Main",
                    "bay_count": 7,
                    "roof_area_m2": 19.05194180550629,
                    "rafter_length_m": 4.823276406457289
                  }
                ],
                "roof_span_m": 4.75,
                "module_count": 1,
                "projection_m": 4.75,
                "rafter_count": 8,
                "rafter_run_m": 4.75,
                "bracket_count": 4,
                "roof_length_m": 3.95,
                "has_our_gutter": true,
                "ridge_length_m": 0,
                "timber_area_m2": 0,
                "acrylic_area_m2": 19.05194180550629,
                "effective_run_m": 4.6,
                "gutter_length_m": 3.95,
                "ledger_length_m": 3.95,
                "rafter_length_m": 4.823276406457289,
                "slope_direction": "away_from_house",
                "covertek_area_m2": 20.95713598605692,
                "flashing_total_m": 17.549999999999997,
                "hip_rafter_count": 0,
                "inverted_enabled": false,
                "overhang_enabled": false,
                "roof_plane_count": 1,
                "joiner_runs_total": 8,
                "overhang_amount_m": 0,
                "post_profile_used": "100x100",
                "rafter_spacing_mm": 557.1428571428571,
                "roof_plane_span_m": 4.75,
                "splice_join_count": 8,
                "tie_beam_length_m": 4.6000000000000005,
                "acrylic_bays_total": 7,
                "roof_area_total_m2": 18.7625,
                "roof_slope_area_m2": 19.05194180550629,
                "strut_profile_used": "50x50",
                "timber_plane_count": 1,
                "total_roof_area_m2": 19.05194180550629,
                "attachment_length_m": 3.95,
                "cut_rafter_length_m": 4.697411461780697,
                "front_beam_length_m": 0,
                "ledger_profile_used": "150x50",
                "our_gutter_length_m": 3.95,
                "polystyrene_area_m2": 19.05194180550629,
                "rafter_clear_len_mm": 3900,
                "rafter_cut_length_m": 4.697411461780697,
                "rafter_profile_auto": "150x50",
                "roof_pitch_deg_used": 10,
                "sp_gutter_run_count": 1,
                "total_rafter_pieces": 8,
                "visible_finish_used": "default",
                "gutter_assembly_mode": "integrated",
                "infill_sheet_area_m2": 0,
                "rafter_run_m_takeoff": 4.6000000000000005,
                "required_downslope_m": 4.690962414674426,
                "roof_surface_area_m2": 19.05194180550629,
                "timber_hidden_finish": "mill",
                "angle_cut_allowance_m": 0.026449047106269746,
                "gable_end_frame_count": 0,
                "house_gutter_length_m": 0,
                "infill_instance_count": 0,
                "infill_joiner_total_m": 0,
                "inverted_house_gutter": false,
                "joiner_piece_length_m": 4.690962414674426,
                "powdercoat_multiplier": null,
                "stringer_fixing_count": 0,
                "tie_beam_profile_used": "150x50",
                "timber_purlin_total_m": 43.45,
                "flashing_0_200_total_m": 0,
                "flashing_startup_count": 1,
                "integrated_gutter_beam": true,
                "overhang_end_cap_count": 0,
                "powdercoat_colour_used": null,
                "rafter_far_allowance_m": 0.1,
                "timber_run_per_plane_m": 4.75,
                "acrylic_install_area_m2": 19.05,
                "front_beam_profile_used": "SP Gutter",
                "kingpost_strut_length_m": 0.4187765791826043,
                "rafter_length_m_assumed": 4.823276406457289,
                "ridge_beam_profile_used": null,
                "separate_gutter_enabled": false,
                "acrylic_plane_count_used": 0,
                "downpipe_join_count_used": 0,
                "flashing_201_300_total_m": 17.549999999999997,
                "flashing_301_400_total_m": 0,
                "infill_strip_panel_count": 0,
                "rafter_house_allowance_m": 0.05,
                "separate_gutter_length_m": 0,
                "downpipe_elbow_count_used": 0,
                "ledger_underside_height_m": 2.4,
                "timber_roof_above_area_m2": 19.05194180550629,
                "acrylic_joiner_top_total_m": 37.53,
                "infill_extra_supports_each": 0,
                "infill_joiner_fixings_each": 0,
                "overhang_stringer_length_m": 0,
                "acrylic_required_downslope_m": 4.690962414674426,
                "post_cut_height_house_side_m": 2.4,
                "post_cut_height_outer_side_m": 1.5888958887410611,
                "timber_slope_len_per_plane_m": 4.823276406457289,
                "acrylic_joiner_bottom_total_m": 37.53,
                "roof_plane_sloped_downslope_m": 4.823276406457289,
                "timber_purlin_lines_per_plane": 11,
                "timber_tray_sheet_count_total": 8,
                "overhang_stringer_profile_used": null,
                "overhang_support_beam_length_m": 0,
                "timber_edge_rafter_count_total": 2,
                "timber_edge_rafter_finish_used": "default",
                "box_perimeter_beam_profile_used": null,
                "timber_edge_rafter_profile_used": "150x50",
                "total_installed_rafter_length_m": 37.579291694245576,
                "timber_common_rafter_count_total": 9,
                "timber_roofing_screws_steel_count": 115,
                "timber_tray_sheet_count_per_plane": 8,
                "acrylic_joiner_bottom_fixings_each": 136,
                "overhang_support_beam_profile_used": null,
                "timber_edge_rafter_count_per_plane": 2,
                "timber_insulated_panel_count_total": 4,
                "timber_common_rafter_count_per_plane": 9,
                "timber_roofing_screws_insulated_count": 77,
                "timber_insulated_panel_count_per_plane": 4
              },
              "install": {
                "totals": {
                  "crew_hours": 24.91,
                  "crew_minutes": 1494.31,
                  "install_ex_gst": 1867.91
                },
                "actions": [
                  {
                    "id": "demob.pack_down",
                    "qty": 1,
                    "unit": "job",
                    "label": "Pack down tools and load out",
                    "scope": "module",
                    "minutes": 30,
                    "category": "Demobilisation",
                    "cost_ex_gst": 37.5,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "demob.rubbish",
                    "qty": 1,
                    "unit": "job",
                    "label": "Rubbish removal (basic)",
                    "scope": "module",
                    "minutes": 60,
                    "category": "Demobilisation",
                    "cost_ex_gst": 75,
                    "applied_multipliers": {
                      "access": 1
                    }
                  },
                  {
                    "id": "drain.install_downpipe",
                    "qty": 1,
                    "unit": "each",
                    "label": "Install downpipe (cut/fit/fasten) - each",
                    "scope": "module",
                    "minutes": 30,
                    "category": "Drainage",
                    "cost_ex_gst": 37.5,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "finish.client_handover",
                    "qty": 1,
                    "unit": "job",
                    "label": "Client walkthrough / handover",
                    "scope": "module",
                    "minutes": 12,
                    "category": "Finishing",
                    "cost_ex_gst": 15,
                    "applied_multipliers": {}
                  },
                  {
                    "id": "finish.final_clean",
                    "qty": 1,
                    "unit": "job",
                    "label": "Final clean and site tidy",
                    "scope": "module",
                    "minutes": 45,
                    "category": "Finishing",
                    "cost_ex_gst": 56.25,
                    "applied_multipliers": {
                      "access": 1
                    }
                  },
                  {
                    "id": "finish.touchups",
                    "qty": 1,
                    "unit": "job",
                    "label": "Touch-ups / sealant / final adjustments",
                    "scope": "module",
                    "minutes": 24,
                    "category": "Finishing",
                    "cost_ex_gst": 30,
                    "applied_multipliers": {
                      "access": 1
                    }
                  },
                  {
                    "id": "frame.front_beam_sp_gutter_install_m",
                    "qty": 3.95,
                    "unit": "metre",
                    "label": "Install SP gutter run - per metre",
                    "scope": "module",
                    "minutes": 37.92,
                    "category": "Frame",
                    "cost_ex_gst": 47.4,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "frame.house_stringer_install_m",
                    "qty": 3.95,
                    "unit": "metre",
                    "label": "Install house-side stringer (default 100x50) - per metre",
                    "scope": "module",
                    "minutes": 28.44,
                    "category": "Frame",
                    "cost_ex_gst": 35.55,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "frame.square_level_frame",
                    "qty": 1,
                    "unit": "job",
                    "label": "Square/level main frame & confirm falls",
                    "scope": "module",
                    "minutes": 30,
                    "category": "Frame",
                    "cost_ex_gst": 37.5,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "house.install_back_stringer_startup",
                    "qty": 1,
                    "unit": "module",
                    "label": "Install back stringer (startup)",
                    "scope": "module",
                    "minutes": 20,
                    "category": "House Connection",
                    "cost_ex_gst": 25,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "house.install_soffit_bracket",
                    "qty": 4,
                    "unit": "bracket",
                    "label": "Install soffit bracket (each)",
                    "scope": "module",
                    "minutes": 96,
                    "category": "House Connection",
                    "cost_ex_gst": 120,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "join.splice_join_each",
                    "qty": 8,
                    "unit": "each",
                    "label": "Install splice join (bracket + screws)",
                    "scope": "module",
                    "minutes": 96,
                    "category": "Joinery",
                    "cost_ex_gst": 120,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "posts.deck_bracket_per_post",
                    "qty": 2,
                    "unit": "post",
                    "label": "Post to deck bracket connection (install + plumb)",
                    "scope": "module",
                    "minutes": 30,
                    "category": "Posts & Footings",
                    "cost_ex_gst": 37.5,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "rafters.install_rafter_pitched",
                    "qty": 8,
                    "unit": "rafter",
                    "label": "Cut + install rafter (pitched roof) - per rafter",
                    "scope": "module",
                    "minutes": 172.96,
                    "category": "Rafters",
                    "cost_ex_gst": 216.2,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1,
                      "roof_type": 1,
                      "structure_type": 1,
                      "pitch_steep_roof": 1,
                      "rafter_length_multiplier": 1.13
                    }
                  },
                  {
                    "id": "rafters.rafter_length_loading_m",
                    "qty": 37.579291694245576,
                    "unit": "metre",
                    "label": "Additional rafter labour loading - per installed metre",
                    "scope": "module",
                    "minutes": 198.19,
                    "category": "Rafters",
                    "cost_ex_gst": 247.74,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1,
                      "roof_type": 1,
                      "structure_type": 1,
                      "pitch_steep_roof": 1,
                      "rafter_length_loading_curve": 4.39
                    }
                  },
                  {
                    "id": "roof.apply_foam_seal_m",
                    "qty": 3.95,
                    "unit": "metre",
                    "label": "Apply foam/weather seal - per metre",
                    "scope": "module",
                    "minutes": 4.74,
                    "category": "Roof",
                    "cost_ex_gst": 5.93,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "roof.fix_joiner_bottom_each",
                    "qty": 136,
                    "unit": "each",
                    "label": "Fix bottom joiner to rafters - each fixing",
                    "scope": "module",
                    "minutes": 81.6,
                    "category": "Roof",
                    "cost_ex_gst": 102,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1,
                      "roof_type": 1,
                      "pitch_steep_roof": 1
                    }
                  },
                  {
                    "id": "roof.flashing_startup",
                    "qty": 1,
                    "unit": "module",
                    "label": "Flashing setup/startup - per module",
                    "scope": "module",
                    "minutes": 36,
                    "category": "Roof",
                    "cost_ex_gst": 45,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "roof.install_acrylic_panels_m2",
                    "qty": 19.05,
                    "unit": "m2",
                    "label": "Install acrylic panels - per m²",
                    "scope": "module",
                    "minutes": 114.3,
                    "category": "Roof",
                    "cost_ex_gst": 142.88,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1,
                      "roof_type": 1,
                      "pitch_steep_roof": 1
                    }
                  },
                  {
                    "id": "roof.install_flashing_201_300_m",
                    "qty": 17.549999999999997,
                    "unit": "metre",
                    "label": "Install flashing 201-300mm - per metre",
                    "scope": "module",
                    "minutes": 189.54,
                    "category": "Roof",
                    "cost_ex_gst": 236.93,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1
                    }
                  },
                  {
                    "id": "roof.install_joiner_bottom_m",
                    "qty": 37.53,
                    "unit": "metre",
                    "label": "Install bottom joiner - per metre",
                    "scope": "module",
                    "minutes": 90.07,
                    "category": "Roof",
                    "cost_ex_gst": 112.59,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1,
                      "roof_type": 1,
                      "pitch_steep_roof": 1
                    }
                  },
                  {
                    "id": "roof.install_joiner_top_m",
                    "qty": 37.53,
                    "unit": "metre",
                    "label": "Install top joiner (no fixings) - per metre",
                    "scope": "module",
                    "minutes": 67.55,
                    "category": "Roof",
                    "cost_ex_gst": 84.44,
                    "applied_multipliers": {
                      "access": 1,
                      "height": 1,
                      "roof_type": 1,
                      "pitch_steep_roof": 1
                    }
                  }
                ]
              },
              "overhead": {
                "method": "site_rollup",
                "ops_ex_gst": 0,
                "sales_ex_gst": 0,
                "total_ex_gst": 0
              },
              "materials": {
                "lines": [
                  {
                    "id": "aluminium-extrusion_18418ef36b",
                    "qty": 1,
                    "unit": "bar",
                    "label": "100x100 6m (Black)",
                    "notes": "Cuts 3.18m from 1×6m; waste 2.82m (Posts)",
                    "profile": "100x100",
                    "line_cost_ex_gst": 154.2,
                    "unit_cost_ex_gst": 154.2
                  },
                  {
                    "id": "aluminium-extrusion_50d03b43ca",
                    "qty": 10,
                    "unit": "bar",
                    "label": "Joiners 4m (Black)",
                    "notes": "Cuts 37.53m from 10×4m; waste 2.47m (Joiners)",
                    "profile": "Joiners",
                    "line_cost_ex_gst": 258,
                    "unit_cost_ex_gst": 25.8
                  },
                  {
                    "id": "aluminium-extrusion_98c1a3ef3b",
                    "qty": 1,
                    "unit": "bar",
                    "label": "SP Gutter 4m (Black)",
                    "notes": "Cuts 3.95m from 1×4m; waste 0.05m (SP gutter)",
                    "profile": "SP Gutter",
                    "line_cost_ex_gst": 171.34,
                    "unit_cost_ex_gst": 171.34
                  },
                  {
                    "id": "aluminium-extrusion_d34cfe5d61",
                    "qty": 8,
                    "unit": "bar",
                    "label": "150x50 5m (Black)",
                    "notes": "Cuts 37.58m from 8×5m; waste 2.42m (Rafters)",
                    "profile": "150x50",
                    "line_cost_ex_gst": 979.2,
                    "unit_cost_ex_gst": 122.4
                  },
                  {
                    "id": "aluminium-extrusion_e0d11c5111",
                    "qty": 1,
                    "unit": "bar",
                    "label": "150x50 4m (Black)",
                    "notes": "Cuts 3.95m from 1×4m; waste 0.05m (Ledger)",
                    "profile": "150x50",
                    "line_cost_ex_gst": 97.92,
                    "unit_cost_ex_gst": 97.92
                  },
                  {
                    "id": "bracket_3f6d3c53fa",
                    "qty": 4,
                    "unit": "each",
                    "label": "Soffit bracket 700x300 L-Bracket",
                    "notes": "Mill",
                    "line_cost_ex_gst": 88,
                    "unit_cost_ex_gst": 22
                  },
                  {
                    "id": "consumable_04259b1a85",
                    "qty": 3.95,
                    "unit": "metre",
                    "label": "Foam 12mm (Black)",
                    "notes": "Foam/weather seal allowance (per metre).",
                    "line_cost_ex_gst": 5.94,
                    "unit_cost_ex_gst": 1.5
                  },
                  {
                    "id": "consumable.alcohol_wipes_pack",
                    "qty": 1,
                    "unit": "each",
                    "label": "Cleaning wipes / alcohol wipes pack",
                    "notes": "Baseline consumables per job. Replace with more explicit line items if you prefer.",
                    "line_cost_ex_gst": 5,
                    "unit_cost_ex_gst": 5
                  },
                  {
                    "id": "consumable.misc_allowance_job",
                    "qty": 1,
                    "unit": "job",
                    "label": "Misc small consumables allowance (bits, blades, tape)",
                    "notes": "Baseline consumables per job. Replace with more explicit line items if you prefer.",
                    "line_cost_ex_gst": 35,
                    "unit_cost_ex_gst": 35
                  },
                  {
                    "id": "consumable.silicone_tube",
                    "qty": 2,
                    "unit": "each",
                    "label": "Neutral cure silicone/sealant tube",
                    "notes": "Baseline consumables per job. Replace with more explicit line items if you prefer.",
                    "line_cost_ex_gst": 18,
                    "unit_cost_ex_gst": 9
                  },
                  {
                    "id": "fixing.coach_screw_m10_each",
                    "qty": 16,
                    "unit": "each",
                    "label": "M10 coach screw (galv) for timber fixing",
                    "notes": "Assumes timber fixing: 4 coach screws per bracket.",
                    "line_cost_ex_gst": 35.2,
                    "unit_cost_ex_gst": 2.2
                  },
                  {
                    "id": "fixing.joiner_screw_each",
                    "qty": 136,
                    "unit": "each",
                    "label": "Joiner fixing screw (for acrylic joiner system)",
                    "notes": "Acrylic joiner bottom fixings: ceil(run_length_m / 0.3) + 1 per run. Top joiner has no fixings.",
                    "line_cost_ex_gst": 47.6,
                    "unit_cost_ex_gst": 0.35
                  },
                  {
                    "id": "fixing.splice_join_screw_each",
                    "qty": 48,
                    "unit": "each",
                    "label": "Splice join screw",
                    "notes": "Placeholder SKU (migrate to supplier pricing).",
                    "line_cost_ex_gst": 24,
                    "unit_cost_ex_gst": 0.5
                  },
                  {
                    "id": "fixing.structural_screw_each",
                    "qty": 64,
                    "unit": "each",
                    "label": "Structural screw (galv) for frame/rafter fixing",
                    "notes": "Assumes 8 structural screws per rafter (4 each end). Tune later.",
                    "line_cost_ex_gst": 48,
                    "unit_cost_ex_gst": 0.75
                  },
                  {
                    "id": "hardware.deck_bracket_assembly",
                    "qty": 2,
                    "unit": "each",
                    "label": "Post-to-deck bracket assembly (bracket + fixings allowance)",
                    "notes": "Per post deck bracket assembly cost includes a fixings allowance. Replace with exact bracket SKU pricing later.",
                    "line_cost_ex_gst": 190,
                    "unit_cost_ex_gst": 95
                  },
                  {
                    "id": "hardware.splice_join_bracket",
                    "qty": 8,
                    "unit": "each",
                    "label": "Splice join bracket",
                    "notes": "Placeholder SKU (migrate to supplier pricing).",
                    "line_cost_ex_gst": 96,
                    "unit_cost_ex_gst": 12
                  },
                  {
                    "id": "powdercoating_199231d91b",
                    "qty": 4,
                    "unit": "each",
                    "label": "Powdercoating for soffit bracket",
                    "line_cost_ex_gst": 26.02,
                    "unit_cost_ex_gst": 6.5
                  },
                  {
                    "id": "roof.flashing_201_300_m",
                    "qty": 17.55,
                    "unit": "metre",
                    "label": "Flashing 201-300mm",
                    "notes": "Flashing material (201-300mm band).",
                    "profile": null,
                    "line_cost_ex_gst": 438.75,
                    "unit_cost_ex_gst": 25
                  },
                  {
                    "id": "roofing-sheet_e44611b74a",
                    "qty": 7,
                    "unit": "bar",
                    "label": "Crystalite sheet 620mm (Clear) 5m",
                    "notes": "Acrylic roofing. Using strip mode: 7 bay(s) × 4.69m = 32.84m total; using 7×5m (1 cut(s)/bar).",
                    "profile": "Crystalite 620mm",
                    "line_cost_ex_gst": 1810.5,
                    "unit_cost_ex_gst": 258.64
                  },
                  {
                    "id": "rubber_4c529ec2b5",
                    "qty": 75.06,
                    "unit": "metre",
                    "label": "Bottom Flat Rubbers",
                    "notes": "Bottom flat rubbers for joiner system (per metre).",
                    "line_cost_ex_gst": 62,
                    "unit_cost_ex_gst": 0.83
                  },
                  {
                    "id": "rubber_b148f37dfa",
                    "qty": 75.06,
                    "unit": "metre",
                    "label": "Top V Rubber",
                    "notes": "Top V rubber for joiner system (per metre).",
                    "line_cost_ex_gst": 49.6,
                    "unit_cost_ex_gst": 0.66
                  }
                ],
                "totals": {
                  "bars_by_profile": {
                    "150x50": {
                      "bars_used": 9,
                      "stock_length_m": 5
                    },
                    "100x100": {
                      "bars_used": 1,
                      "stock_length_m": 6
                    },
                    "Joiners": {
                      "bars_used": 10,
                      "stock_length_m": 4
                    },
                    "SP Gutter": {
                      "bars_used": 1,
                      "stock_length_m": 4
                    },
                    "Crystalite 620mm": {
                      "bars_used": 7,
                      "stock_length_m": 5
                    }
                  },
                  "materials_ex_gst": 4640.27,
                  "bars_by_cut_group": {
                    "100x100__Black__default__posts": {
                      "bars_used": 1,
                      "stock_length_m": 6
                    },
                    "150x50__Black__default__ledger": {
                      "bars_used": 1,
                      "stock_length_m": 4
                    },
                    "150x50__Black__default__rafters": {
                      "bars_used": 8,
                      "stock_length_m": 5
                    },
                    "SP Gutter__Black__default__sp_gutter": {
                      "bars_used": 1,
                      "stock_length_m": 4
                    },
                    "Joiners__Black__default__joiners_roof": {
                      "bars_used": 10,
                      "stock_length_m": 4
                    }
                  },
                  "waste_m_by_profile": {
                    "150x50": 2.47,
                    "100x100": 2.82,
                    "Joiners": 2.47,
                    "SP Gutter": 0.05,
                    "Crystalite 620mm": 2.16
                  },
                  "waste_m_by_cut_group": {
                    "100x100__Black__default__posts": 2.82,
                    "150x50__Black__default__ledger": 0.05,
                    "150x50__Black__default__rafters": 2.42,
                    "SP Gutter__Black__default__sp_gutter": 0.05,
                    "Joiners__Black__default__joiners_roof": 2.47
                  }
                }
              },
              "inputs_normalized": {
                "access": "normal",
                "ground": "easy",
                "height": "single_storey",
                "length_m": 3.95,
                "flashings": {
                  "extras": [
                    {
                      "band": "201-300",
                      "length_m": 3.95
                    },
                    {
                      "band": "201-300",
                      "length_m": 4.75
                    },
                    {
                      "band": "201-300",
                      "length_m": 4.75
                    },
                    {
                      "band": "201-300",
                      "length_m": 4.1
                    }
                  ],
                  "defaults": [
                    {
                      "key": "pitched_primary",
                      "label": "Primary flashing",
                      "length_m": 3.95,
                      "default_band": "201-300",
                      "selected_band": "none"
                    }
                  ],
                  "total_length_m": 17.549999999999997,
                  "totals_m_by_band": {
                    "0-200": 0,
                    "201-300": 17.549999999999997,
                    "301-400": 0
                  }
                },
                "roof_type": "pitched",
                "mixed_roof": null,
                "post_count": 2,
                "gutter_type": "sp_gutter",
                "projection_m": 4.75,
                "foam_length_m": 3.95,
                "roof_material": "acrylic",
                "travel_ex_gst": 0,
                "downpipe_count": 1,
                "rafter_profile": "150x50",
                "roof_pitch_deg": 10,
                "structure_type": "pitched",
                "attachment_side": "rear",
                "gutter_length_m": 3.95,
                "box_beam_profile": null,
                "extrusion_colour": "Black",
                "fall_distance_mm": null,
                "inverted_enabled": false,
                "overhang_enabled": false,
                "pergola_style_ui": "pitched",
                "flashing_length_m": 17.549999999999997,
                "overhang_amount_m": 0,
                "post_cut_height_m": 1.5888958887410611,
                "quote_discount_pct": 0,
                "acrylic_sheet_count": 4,
                "box_gutter_far_edge": "none",
                "downpipe_join_count": 0,
                "downpipe_elbow_count": 0,
                "post_connection_type": "deck_bracket",
                "timber_tray_width_mm": 500,
                "box_gutter_house_edge": "none",
                "gable_end_frames_mode": "outer_end_only",
                "hip_corner_length_b_m": null,
                "house_connection_type": "soffit",
                "inverted_house_gutter": false,
                "timber_roof_above_type": "insulated_panels",
                "extras_allowance_ex_gst": 0,
                "separate_gutter_enabled": false,
                "hip_corner_projection_b_m": null,
                "timber_roof_allowance_ex_gst": 0,
                "overhang_support_beam_profile": null,
                "timber_insulated_panel_thickness_mm": 50
              }
            }
          ],
          "overhead": {
            "method": "fixed_plus_variable",
            "ops_ex_gst": 3613.75,
            "sales_ex_gst": 1517.86,
            "total_ex_gst": 5131.61
          },
          "materials": {
            "lines": [
              {
                "id": "job.hire.scaffolding_day_rate",
                "qty": 5,
                "unit": "day",
                "label": "[Job] Scaffolding day hire",
                "profile": "Scaffolding",
                "line_cost_ex_gst": 500,
                "unit_cost_ex_gst": 100
              },
              {
                "id": "m1.aluminium-extrusion_18418ef36b",
                "qty": 1,
                "unit": "bar",
                "label": "[M1] 100x100 6m (Black)",
                "notes": "Cuts 3.18m from 1×6m; waste 2.82m (Posts)",
                "profile": "100x100",
                "line_cost_ex_gst": 154.2,
                "unit_cost_ex_gst": 154.2
              },
              {
                "id": "m1.aluminium-extrusion_50d03b43ca",
                "qty": 10,
                "unit": "bar",
                "label": "[M1] Joiners 4m (Black)",
                "notes": "Cuts 37.53m from 10×4m; waste 2.47m (Joiners)",
                "profile": "Joiners",
                "line_cost_ex_gst": 258,
                "unit_cost_ex_gst": 25.8
              },
              {
                "id": "m1.aluminium-extrusion_98c1a3ef3b",
                "qty": 1,
                "unit": "bar",
                "label": "[M1] SP Gutter 4m (Black)",
                "notes": "Cuts 3.95m from 1×4m; waste 0.05m (SP gutter)",
                "profile": "SP Gutter",
                "line_cost_ex_gst": 171.34,
                "unit_cost_ex_gst": 171.34
              },
              {
                "id": "m1.aluminium-extrusion_d34cfe5d61",
                "qty": 8,
                "unit": "bar",
                "label": "[M1] 150x50 5m (Black)",
                "notes": "Cuts 37.58m from 8×5m; waste 2.42m (Rafters)",
                "profile": "150x50",
                "line_cost_ex_gst": 979.2,
                "unit_cost_ex_gst": 122.4
              },
              {
                "id": "m1.aluminium-extrusion_e0d11c5111",
                "qty": 1,
                "unit": "bar",
                "label": "[M1] 150x50 4m (Black)",
                "notes": "Cuts 3.95m from 1×4m; waste 0.05m (Ledger)",
                "profile": "150x50",
                "line_cost_ex_gst": 97.92,
                "unit_cost_ex_gst": 97.92
              },
              {
                "id": "m1.bracket_3f6d3c53fa",
                "qty": 4,
                "unit": "each",
                "label": "[M1] Soffit bracket 700x300 L-Bracket",
                "notes": "Mill",
                "line_cost_ex_gst": 88,
                "unit_cost_ex_gst": 22
              },
              {
                "id": "m1.consumable_04259b1a85",
                "qty": 3.95,
                "unit": "metre",
                "label": "[M1] Foam 12mm (Black)",
                "notes": "Foam/weather seal allowance (per metre).",
                "line_cost_ex_gst": 5.94,
                "unit_cost_ex_gst": 1.5
              },
              {
                "id": "m1.consumable.alcohol_wipes_pack",
                "qty": 1,
                "unit": "each",
                "label": "[M1] Cleaning wipes / alcohol wipes pack",
                "notes": "Baseline consumables per job. Replace with more explicit line items if you prefer.",
                "line_cost_ex_gst": 5,
                "unit_cost_ex_gst": 5
              },
              {
                "id": "m1.consumable.misc_allowance_job",
                "qty": 1,
                "unit": "job",
                "label": "[M1] Misc small consumables allowance (bits, blades, tape)",
                "notes": "Baseline consumables per job. Replace with more explicit line items if you prefer.",
                "line_cost_ex_gst": 35,
                "unit_cost_ex_gst": 35
              },
              {
                "id": "m1.consumable.silicone_tube",
                "qty": 2,
                "unit": "each",
                "label": "[M1] Neutral cure silicone/sealant tube",
                "notes": "Baseline consumables per job. Replace with more explicit line items if you prefer.",
                "line_cost_ex_gst": 18,
                "unit_cost_ex_gst": 9
              },
              {
                "id": "m1.fixing.coach_screw_m10_each",
                "qty": 16,
                "unit": "each",
                "label": "[M1] M10 coach screw (galv) for timber fixing",
                "notes": "Assumes timber fixing: 4 coach screws per bracket.",
                "line_cost_ex_gst": 35.2,
                "unit_cost_ex_gst": 2.2
              },
              {
                "id": "m1.fixing.joiner_screw_each",
                "qty": 136,
                "unit": "each",
                "label": "[M1] Joiner fixing screw (for acrylic joiner system)",
                "notes": "Acrylic joiner bottom fixings: ceil(run_length_m / 0.3) + 1 per run. Top joiner has no fixings.",
                "line_cost_ex_gst": 47.6,
                "unit_cost_ex_gst": 0.35
              },
              {
                "id": "m1.fixing.splice_join_screw_each",
                "qty": 48,
                "unit": "each",
                "label": "[M1] Splice join screw",
                "notes": "Placeholder SKU (migrate to supplier pricing).",
                "line_cost_ex_gst": 24,
                "unit_cost_ex_gst": 0.5
              },
              {
                "id": "m1.fixing.structural_screw_each",
                "qty": 64,
                "unit": "each",
                "label": "[M1] Structural screw (galv) for frame/rafter fixing",
                "notes": "Assumes 8 structural screws per rafter (4 each end). Tune later.",
                "line_cost_ex_gst": 48,
                "unit_cost_ex_gst": 0.75
              },
              {
                "id": "m1.hardware.deck_bracket_assembly",
                "qty": 2,
                "unit": "each",
                "label": "[M1] Post-to-deck bracket assembly (bracket + fixings allowance)",
                "notes": "Per post deck bracket assembly cost includes a fixings allowance. Replace with exact bracket SKU pricing later.",
                "line_cost_ex_gst": 190,
                "unit_cost_ex_gst": 95
              },
              {
                "id": "m1.hardware.splice_join_bracket",
                "qty": 8,
                "unit": "each",
                "label": "[M1] Splice join bracket",
                "notes": "Placeholder SKU (migrate to supplier pricing).",
                "line_cost_ex_gst": 96,
                "unit_cost_ex_gst": 12
              },
              {
                "id": "m1.powdercoating_199231d91b",
                "qty": 4,
                "unit": "each",
                "label": "[M1] Powdercoating for soffit bracket",
                "line_cost_ex_gst": 26.02,
                "unit_cost_ex_gst": 6.5
              },
              {
                "id": "m1.roof.flashing_201_300_m",
                "qty": 17.55,
                "unit": "metre",
                "label": "[M1] Flashing 201-300mm",
                "notes": "Flashing material (201-300mm band).",
                "profile": null,
                "line_cost_ex_gst": 438.75,
                "unit_cost_ex_gst": 25
              },
              {
                "id": "m1.roofing-sheet_e44611b74a",
                "qty": 7,
                "unit": "bar",
                "label": "[M1] Crystalite sheet 620mm (Clear) 5m",
                "notes": "Acrylic roofing. Using strip mode: 7 bay(s) × 4.69m = 32.84m total; using 7×5m (1 cut(s)/bar).",
                "profile": "Crystalite 620mm",
                "line_cost_ex_gst": 1810.5,
                "unit_cost_ex_gst": 258.64
              },
              {
                "id": "m1.rubber_4c529ec2b5",
                "qty": 75.06,
                "unit": "metre",
                "label": "[M1] Bottom Flat Rubbers",
                "notes": "Bottom flat rubbers for joiner system (per metre).",
                "line_cost_ex_gst": 62,
                "unit_cost_ex_gst": 0.83
              },
              {
                "id": "m1.rubber_b148f37dfa",
                "qty": 75.06,
                "unit": "metre",
                "label": "[M1] Top V Rubber",
                "notes": "Top V rubber for joiner system (per metre).",
                "line_cost_ex_gst": 49.6,
                "unit_cost_ex_gst": 0.66
              }
            ],
            "totals": {
              "bars_by_profile": {
                "150x50": {
                  "bars_used": 9,
                  "stock_length_m": 5
                },
                "100x100": {
                  "bars_used": 1,
                  "stock_length_m": 6
                },
                "Joiners": {
                  "bars_used": 10,
                  "stock_length_m": 4
                },
                "SP Gutter": {
                  "bars_used": 1,
                  "stock_length_m": 4
                },
                "Crystalite 620mm": {
                  "bars_used": 7,
                  "stock_length_m": 5
                }
              },
              "materials_ex_gst": 5140.27,
              "waste_m_by_profile": {
                "150x50": 2.47,
                "100x100": 2.82,
                "Joiners": 2.47,
                "SP Gutter": 0.05,
                "Crystalite 620mm": 2.16
              }
            }
          },
          "module_count": 1
        }
      ],
      "snapshot": {
        "contact": {
          "email": "jordan@sanctuarypergolas.co.nz",
          "phone": "417987676",
          "displayName": "Test"
        },
        "project": {
          "projectName": "Test",
          "siteAddress": "South Yarra"
        }
      },
      "warnings": [],
      "materials": {
        "lines": [
          {
            "id": "m1.aluminium-extrusion_18418ef36b",
            "qty": 1,
            "unit": "bar",
            "label": "[Pergola 1 M1] 100x100 6m (Black)",
            "notes": "Cuts 3.18m from 1×6m; waste 2.82m (Posts)",
            "profile": "100x100",
            "line_cost_ex_gst": 154.2,
            "unit_cost_ex_gst": 154.2
          },
          {
            "id": "m1.aluminium-extrusion_50d03b43ca",
            "qty": 10,
            "unit": "bar",
            "label": "[Pergola 1 M1] Joiners 4m (Black)",
            "notes": "Cuts 37.53m from 10×4m; waste 2.47m (Joiners)",
            "profile": "Joiners",
            "line_cost_ex_gst": 258,
            "unit_cost_ex_gst": 25.8
          },
          {
            "id": "m1.aluminium-extrusion_98c1a3ef3b",
            "qty": 1,
            "unit": "bar",
            "label": "[Pergola 1 M1] SP Gutter 4m (Black)",
            "notes": "Cuts 3.95m from 1×4m; waste 0.05m (SP gutter)",
            "profile": "SP Gutter",
            "line_cost_ex_gst": 171.34,
            "unit_cost_ex_gst": 171.34
          },
          {
            "id": "m1.aluminium-extrusion_d34cfe5d61",
            "qty": 8,
            "unit": "bar",
            "label": "[Pergola 1 M1] 150x50 5m (Black)",
            "notes": "Cuts 37.58m from 8×5m; waste 2.42m (Rafters)",
            "profile": "150x50",
            "line_cost_ex_gst": 979.2,
            "unit_cost_ex_gst": 122.4
          },
          {
            "id": "m1.aluminium-extrusion_e0d11c5111",
            "qty": 1,
            "unit": "bar",
            "label": "[Pergola 1 M1] 150x50 4m (Black)",
            "notes": "Cuts 3.95m from 1×4m; waste 0.05m (Ledger)",
            "profile": "150x50",
            "line_cost_ex_gst": 97.92,
            "unit_cost_ex_gst": 97.92
          },
          {
            "id": "m1.bracket_3f6d3c53fa",
            "qty": 4,
            "unit": "each",
            "label": "[Pergola 1 M1] Soffit bracket 700x300 L-Bracket",
            "notes": "Mill",
            "line_cost_ex_gst": 88,
            "unit_cost_ex_gst": 22
          },
          {
            "id": "m1.consumable_04259b1a85",
            "qty": 3.95,
            "unit": "metre",
            "label": "[Pergola 1 M1] Foam 12mm (Black)",
            "notes": "Foam/weather seal allowance (per metre).",
            "line_cost_ex_gst": 5.94,
            "unit_cost_ex_gst": 1.5
          },
          {
            "id": "m1.consumable.alcohol_wipes_pack",
            "qty": 1,
            "unit": "each",
            "label": "[Pergola 1 M1] Cleaning wipes / alcohol wipes pack",
            "notes": "Baseline consumables per job. Replace with more explicit line items if you prefer.",
            "line_cost_ex_gst": 5,
            "unit_cost_ex_gst": 5
          },
          {
            "id": "m1.consumable.misc_allowance_job",
            "qty": 1,
            "unit": "job",
            "label": "[Pergola 1 M1] Misc small consumables allowance (bits, blades, tape)",
            "notes": "Baseline consumables per job. Replace with more explicit line items if you prefer.",
            "line_cost_ex_gst": 35,
            "unit_cost_ex_gst": 35
          },
          {
            "id": "m1.consumable.silicone_tube",
            "qty": 2,
            "unit": "each",
            "label": "[Pergola 1 M1] Neutral cure silicone/sealant tube",
            "notes": "Baseline consumables per job. Replace with more explicit line items if you prefer.",
            "line_cost_ex_gst": 18,
            "unit_cost_ex_gst": 9
          },
          {
            "id": "m1.fixing.coach_screw_m10_each",
            "qty": 16,
            "unit": "each",
            "label": "[Pergola 1 M1] M10 coach screw (galv) for timber fixing",
            "notes": "Assumes timber fixing: 4 coach screws per bracket.",
            "line_cost_ex_gst": 35.2,
            "unit_cost_ex_gst": 2.2
          },
          {
            "id": "m1.fixing.joiner_screw_each",
            "qty": 136,
            "unit": "each",
            "label": "[Pergola 1 M1] Joiner fixing screw (for acrylic joiner system)",
            "notes": "Acrylic joiner bottom fixings: ceil(run_length_m / 0.3) + 1 per run. Top joiner has no fixings.",
            "line_cost_ex_gst": 47.6,
            "unit_cost_ex_gst": 0.35
          },
          {
            "id": "m1.fixing.splice_join_screw_each",
            "qty": 48,
            "unit": "each",
            "label": "[Pergola 1 M1] Splice join screw",
            "notes": "Placeholder SKU (migrate to supplier pricing).",
            "line_cost_ex_gst": 24,
            "unit_cost_ex_gst": 0.5
          },
          {
            "id": "m1.fixing.structural_screw_each",
            "qty": 64,
            "unit": "each",
            "label": "[Pergola 1 M1] Structural screw (galv) for frame/rafter fixing",
            "notes": "Assumes 8 structural screws per rafter (4 each end). Tune later.",
            "line_cost_ex_gst": 48,
            "unit_cost_ex_gst": 0.75
          },
          {
            "id": "m1.hardware.deck_bracket_assembly",
            "qty": 2,
            "unit": "each",
            "label": "[Pergola 1 M1] Post-to-deck bracket assembly (bracket + fixings allowance)",
            "notes": "Per post deck bracket assembly cost includes a fixings allowance. Replace with exact bracket SKU pricing later.",
            "line_cost_ex_gst": 190,
            "unit_cost_ex_gst": 95
          },
          {
            "id": "m1.hardware.splice_join_bracket",
            "qty": 8,
            "unit": "each",
            "label": "[Pergola 1 M1] Splice join bracket",
            "notes": "Placeholder SKU (migrate to supplier pricing).",
            "line_cost_ex_gst": 96,
            "unit_cost_ex_gst": 12
          },
          {
            "id": "m1.powdercoating_199231d91b",
            "qty": 4,
            "unit": "each",
            "label": "[Pergola 1 M1] Powdercoating for soffit bracket",
            "line_cost_ex_gst": 26.02,
            "unit_cost_ex_gst": 6.5
          },
          {
            "id": "m1.roof.flashing_201_300_m",
            "qty": 17.55,
            "unit": "metre",
            "label": "[Pergola 1 M1] Flashing 201-300mm",
            "notes": "Flashing material (201-300mm band).",
            "profile": null,
            "line_cost_ex_gst": 438.75,
            "unit_cost_ex_gst": 25
          },
          {
            "id": "m1.roofing-sheet_e44611b74a",
            "qty": 7,
            "unit": "bar",
            "label": "[Pergola 1 M1] Crystalite sheet 620mm (Clear) 5m",
            "notes": "Acrylic roofing. Using strip mode: 7 bay(s) × 4.69m = 32.84m total; using 7×5m (1 cut(s)/bar).",
            "profile": "Crystalite 620mm",
            "line_cost_ex_gst": 1810.5,
            "unit_cost_ex_gst": 258.64
          },
          {
            "id": "m1.rubber_4c529ec2b5",
            "qty": 75.06,
            "unit": "metre",
            "label": "[Pergola 1 M1] Bottom Flat Rubbers",
            "notes": "Bottom flat rubbers for joiner system (per metre).",
            "line_cost_ex_gst": 62,
            "unit_cost_ex_gst": 0.83
          },
          {
            "id": "m1.rubber_b148f37dfa",
            "qty": 75.06,
            "unit": "metre",
            "label": "[Pergola 1 M1] Top V Rubber",
            "notes": "Top V rubber for joiner system (per metre).",
            "line_cost_ex_gst": 49.6,
            "unit_cost_ex_gst": 0.66
          },
          {
            "id": "p1.job.hire.scaffolding_day_rate",
            "qty": 5,
            "unit": "day",
            "label": "[Pergola 1] [Job] Scaffolding day hire",
            "profile": "Scaffolding",
            "line_cost_ex_gst": 500,
            "unit_cost_ex_gst": 100
          }
        ],
        "totals": {
          "bars_by_profile": {
            "150x50": {
              "bars_used": 9,
              "stock_length_m": 5
            },
            "100x100": {
              "bars_used": 1,
              "stock_length_m": 6
            },
            "Joiners": {
              "bars_used": 10,
              "stock_length_m": 4
            },
            "SP Gutter": {
              "bars_used": 1,
              "stock_length_m": 4
            },
            "Crystalite 620mm": {
              "bars_used": 7,
              "stock_length_m": 5
            }
          },
          "materials_ex_gst": 5140.27,
          "waste_m_by_profile": {
            "150x50": 2.47,
            "100x100": 2.82,
            "Joiners": 2.47,
            "SP Gutter": 0.05,
            "Crystalite 620mm": 2.16
          }
        }
      },
      "siteShared": {
        "totals": {
          "warnings": [],
          "cost_ex_gst": 4822.5,
          "cost_inc_gst": 5545.88,
          "notes_and_warnings": []
        },
        "add_ons": {
          "travel_ex_gst": 3000,
          "extras_allowance_ex_gst": 1000
        },
        "install": {
          "totals": {
            "crew_hours": 10.97,
            "crew_minutes": 658,
            "install_ex_gst": 822.5
          },
          "actions": [
            {
              "id": "job.day_cycle.daily_tidy",
              "qty": 5,
              "unit": "day",
              "label": "[Job] Daily tidy up",
              "scope": "job",
              "minutes": 90,
              "category": "Mobilisation",
              "cost_ex_gst": 112.5,
              "applied_multipliers": {
                "access": 1,
                "height": 1
              }
            },
            {
              "id": "job.day_cycle.pack_down_tools",
              "qty": 5,
              "unit": "day",
              "label": "[Job] Daily pack down / tool load-out",
              "scope": "job",
              "minutes": 150,
              "category": "Mobilisation",
              "cost_ex_gst": 187.5,
              "applied_multipliers": {
                "access": 1,
                "height": 1
              }
            },
            {
              "id": "job.day_cycle.setup_tools",
              "qty": 5,
              "unit": "day",
              "label": "[Job] Daily setup / tool unload & staging",
              "scope": "job",
              "minutes": 150,
              "category": "Mobilisation",
              "cost_ex_gst": 187.5,
              "applied_multipliers": {
                "access": 1,
                "height": 1
              }
            },
            {
              "id": "job.drain.gutter_startup_job",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Gutter startup (end caps + droppers/outlets)",
              "scope": "job",
              "minutes": 36,
              "category": "Drainage",
              "cost_ex_gst": 45,
              "applied_multipliers": {
                "access": 1,
                "height": 1
              }
            },
            {
              "id": "job.mob.client_briefing",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Client briefing / confirm scope on arrival",
              "scope": "job",
              "minutes": 15,
              "category": "Mobilisation",
              "cost_ex_gst": 18.75,
              "applied_multipliers": {
                "access": 1
              }
            },
            {
              "id": "job.mob.offload_materials",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Materials offloaded & staged",
              "scope": "job",
              "minutes": 10,
              "category": "Mobilisation",
              "cost_ex_gst": 12.5,
              "applied_multipliers": {
                "access_logistics": 1
              }
            },
            {
              "id": "job.mob.scaffolding_startup",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Scaffolding setup, packdown and load labour",
              "scope": "job",
              "minutes": 150,
              "category": "Mob",
              "cost_ex_gst": 187.5,
              "applied_multipliers": {}
            },
            {
              "id": "job.mob.site_safety",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Site safety checklist / toolbox talk",
              "scope": "job",
              "minutes": 15,
              "category": "Mobilisation",
              "cost_ex_gst": 18.75,
              "applied_multipliers": {}
            },
            {
              "id": "job.mob.site_survey",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Site survey / set-out verification",
              "scope": "job",
              "minutes": 18,
              "category": "Mobilisation",
              "cost_ex_gst": 22.5,
              "applied_multipliers": {
                "access": 1
              }
            },
            {
              "id": "job.mob.tool_setup",
              "qty": 1,
              "unit": "job",
              "label": "[Job] Tool setup & staging",
              "scope": "job",
              "minutes": 24,
              "category": "Mobilisation",
              "cost_ex_gst": 30,
              "applied_multipliers": {}
            }
          ]
        }
      },
      "configVersions": {
        "rules": "packages/costing/src/config/costing_rules_v1.3_2026-01-08.json",
        "manifest": "packages/costing/src/config/costing_manifest_v1.7_2026-03-27.json",
        "overheads": "packages/costing/src/config/overheads_v1.1_2026-01-08.json",
        "pricebook": "packages/costing/src/config/materials/sanctuary_pricebook_materials_2025-11_exgst_v1.1.json",
        "installActions": "packages/costing/src/config/install_actions_v1.7_2026-03-27.json"
      },
      "projectSnapshot": {
        "id": "proj_76a726e3-b0a3-4c17-9a29-613482645a8f",
        "name": "Test",
        "notes": "",
        "isLost": false,
        "status": "NEW",
        "address": "South Yarra",
        "contactId": "ct_ba59d48f-d0b5-4a75-9a3d-295f538f2e88",
        "createdAt": "2026-05-13T08:52:31.389+00:00",
        "updatedAt": "2026-05-13T08:52:31.389+00:00",
        "isArchived": false,
        "projectName": "Test",
        "siteAddress": "South Yarra",
        "followUpDate": null,
        "nextActionDate": null,
        "depositPaidDate": null,
        "finalPaymentDate": null,
        "depositAmountCents": null
      },
      "pricing_sync_state": "current",
      "cost_snapshot_version": "v2"
    },
    "warnings": [],
    "costing_manifest": "packages/costing/src/config/costing_manifest_v1.7_2026-03-27.json",
    "costing_rules": "packages/costing/src/config/costing_rules_v1.3_2026-01-08.json"
  },
  "objectFirst": null,
  "selectedState": {
    "activeObjectRef": {
      "family": "house_forms",
      "objectId": "house-main"
    },
    "activePergolaId": "pergola-1",
    "activeModuleIndex": 0,
    "viewportMode": "geometry3d"
  },
  "renderDiagnostics": {
    "projectPreviewSource": "project_pipeline",
    "houseGeometryInputsById": {
      "house-main": {
        "houseFormId": "house-main",
        "footprintPointCount": 4,
        "rawHouseInputPresent": true,
        "referencePresent": true,
        "modelPresent": true,
        "wallCount": 4,
        "roofPlaneCount": 1,
        "failureStage": "none",
        "diagnosticCode": "eave_polygon_construction_failed",
        "roofPipelineFailureStage": "eave_polygon_construction",
        "footprintNormalizationStatus": "ok",
        "eavePolygonConstructionStatus": "failed",
        "roofIntentNormalizationStatus": "ok",
        "roofTopologyClassificationStatus": "ok",
        "roofPlaneGenerationStatus": "ok",
        "roofQaValidationStatus": "ok",
        "eavePolygonPointCount": 0,
        "roofIntentForm": "mono",
        "roofIntentPitchDeg": 25,
        "roofIntentRidgeAxis": "x",
        "roofGeometry": "footprint_mono",
        "roofFacetMergeMode": null,
        "roofTopologyFailureReason": null,
        "roofTopologyFinalFaceCount": null,
        "roofTopologySourceEdgeCount": null,
        "roofTopologyDisconnectedSourceFaceCount": null,
        "roofTopologyInternalEaveHeightSegmentCount": null,
        "roofTopologyProjectionViolationCount": null,
        "roofWavefrontFailureReason": null,
        "roofQaStatus": "valid",
        "roofQaFailureReason": null,
        "roofQaRejectedFacetCount": 0,
        "roofQaFacetAreaMm2": 18630000,
        "roofQaEaveAreaMm2": 18630000,
        "roofQaAreaDeltaMm2": 0,
        "roofPlaneCountBeforeQa": 1,
        "roofPlaneCountAfterQa": 1,
        "roofMaterialVisualCount": 1,
        "roofSolidCount": 1
      }
    },
    "projectHouseProjectionHealth": [
      {
        "houseFormId": "house-main",
        "geometryInputPresent": true,
        "rawHouseInputPresent": true,
        "footprintPointCount": 4,
        "referencePresent": true,
        "modelPresent": true,
        "wallCount": 4,
        "roofPlaneCount": 1,
        "roofBodyCount": 2,
        "roofMaterialBodyCount": 1,
        "planBodyIds": [
          "house_roof_material:house-main:house-roof-material-house-roof-mono-1",
          "house_surface_solid:house-main:house-solid-house-roof-mono-1"
        ],
        "roofBodyIds": [
          "house_roof_material:house-main:house-roof-material-house-roof-mono-1",
          "house_surface_solid:house-main:house-solid-house-roof-mono-1"
        ],
        "roofMaterialBodyIds": [
          "house_roof_material:house-main:house-roof-material-house-roof-mono-1"
        ],
        "sceneBodyCount": 9,
        "sceneRoofMaterialBodyCount": 1,
        "canRenderCommittedBody": true,
        "visibleReferenceFallbackIds": [],
        "failureStage": "none",
        "diagnosticCode": "eave_polygon_construction_failed",
        "roofValidationStatus": "valid",
        "roofValidationCode": null,
        "sceneRoofBodyCount": 1,
        "footprintNormalizationStatus": "ok",
        "eavePolygonConstructionStatus": "failed",
        "roofIntentNormalizationStatus": "ok",
        "roofTopologyClassificationStatus": "ok",
        "roofPlaneGenerationStatus": "ok",
        "roofQaValidationStatus": "ok",
        "eavePolygonPointCount": 0,
        "roofIntentForm": "mono",
        "roofIntentPitchDeg": 25,
        "roofIntentRidgeAxis": "x",
        "roofGeometry": "footprint_mono",
        "roofFacetMergeMode": null,
        "roofTopologyFailureReason": null,
        "roofTopologyFinalFaceCount": null,
        "roofTopologySourceEdgeCount": null,
        "roofTopologyDisconnectedSourceFaceCount": null,
        "roofTopologyInternalEaveHeightSegmentCount": null,
        "roofTopologyProjectionViolationCount": null,
        "roofWavefrontFailureReason": null,
        "roofQaStatus": "valid",
        "roofQaFailureReason": null,
        "roofQaRejectedFacetCount": 0,
        "roofQaFacetAreaMm2": 18630000,
        "roofQaEaveAreaMm2": 18630000,
        "roofQaAreaDeltaMm2": 0,
        "roofPlaneCountBeforeQa": 1,
        "roofPlaneCountAfterQa": 1,
        "roofMaterialVisualCount": 1,
        "roofSolidCount": 1
      }
    ],
    "projectPergolaRenderHealth": [
      {
        "pergolaId": "pergola-1",
        "moduleId": "module-1",
        "sourceKind": "drawing_module",
        "solveStatus": "geometry_ready",
        "hostObjectId": null,
        "hostEdgeId": null,
        "attachmentEdgeId": "footprint-edge-3",
        "attachmentZoneId": "zone-soffit-footprint-edge-3",
        "hostAttachmentStatus": "resolved",
        "hostAttachmentCode": null,
        "placementStatus": "resolved",
        "placementCode": null,
        "planBodyCount": 30,
        "sceneBodyCount": 33,
        "canRenderCommittedBody": true,
        "suppressedCommittedBodyReason": "none"
      }
    ]
  }
} as WorkbenchDebugFixtureExport;
