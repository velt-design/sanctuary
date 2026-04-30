import { describe, expect, it } from 'vitest';
import type { HouseFootprintPreset, HouseRoofForm } from './contracts';
import { buildHouseFootprintPolygon } from './footprints';
import {
  classifyHouseRoofFootprintTopology,
  deriveHouseRoofCapabilities,
  deriveHouseRoofGeometryKind,
  validateHouseRoofSelection,
} from './houseRoofValidation';

const HOUSE_FOOTPRINT_PRESETS: readonly HouseFootprintPreset[] = [
  'straight',
  'l_left',
  'l_right',
  'recess_left',
  'recess_right',
  'u_shape',
  'wrap_left',
  'wrap_right',
];

const HOUSE_ROOF_FORMS: readonly HouseRoofForm[] = ['flat', 'mono', 'gable', 'hipped'];

function buildPresetFootprint(preset: HouseFootprintPreset) {
  return buildHouseFootprintPolygon({
    pergolaWidthMm: 6000,
    pergolaDepthMm: 1800,
    preset,
    attachmentSide: 'rear',
  });
}

describe('house roof validation', () => {
  it('supports every live roof form on every preset house footprint', () => {
    for (const preset of HOUSE_FOOTPRINT_PRESETS) {
      const footprint = buildPresetFootprint(preset);
      const topology = classifyHouseRoofFootprintTopology(footprint);

      expect(topology, `${preset} should be rectangular or orthogonal`).not.toBe('polygonal');

      for (const roofForm of HOUSE_ROOF_FORMS) {
        const geometryKind = deriveHouseRoofGeometryKind({ roofForm, footprint });
        const capabilities = deriveHouseRoofCapabilities({ roofForm, footprint });
        const validation = validateHouseRoofSelection({
          roofForm,
          footprint,
          appendageEnabled: false,
          roofPrimaryFallDirection: 'negative_y',
          roofRidgeAxis: 'x',
        });

        expect(geometryKind, `${preset}/${roofForm} geometry kind`).not.toBeNull();
        expect(capabilities.selectedFormSupported, `${preset}/${roofForm} supported`).toBe(true);
        expect(validation.status, `${preset}/${roofForm} validation status`).toBe('valid');
        expect(validation.code, `${preset}/${roofForm} validation code`).toBeNull();
      }
    }
  });

  it('keeps unsupported non-orthogonal custom gable and hipped forms blocked', () => {
    const polygonalFootprint = [
      { x: 0, y: -1800, z: 0 },
      { x: 6000, y: -1800, z: 0 },
      { x: 4200, y: 600, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];

    for (const roofForm of ['gable', 'hipped'] as const) {
      const capabilities = deriveHouseRoofCapabilities({
        roofForm,
        footprint: polygonalFootprint,
      });
      const validation = validateHouseRoofSelection({
        roofForm,
        footprint: polygonalFootprint,
        appendageEnabled: false,
        roofRidgeAxis: 'x',
      });

      expect(capabilities.footprintTopology).toBe('polygonal');
      expect(capabilities.selectedFormSupported).toBe(false);
      expect(validation.status).toBe('invalid');
      expect(validation.blockedBy).toBe('selected_form');
      expect(validation.code).toBe(
        roofForm === 'gable' ? 'unsupported_gable_topology' : 'unsupported_hipped_topology',
      );
    }
  });
});
