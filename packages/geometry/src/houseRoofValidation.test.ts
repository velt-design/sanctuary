import { describe, expect, it } from 'vitest';
import type { AttachmentSide, HouseFootprintPreset, HouseRoofForm } from './contracts';
import { buildHouseFootprintPolygon } from './footprints';
import {
  classifyHouseRoofFootprintTopology,
  deriveHouseRoofCapabilities,
  deriveHouseRoofGeometryKind,
  MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG,
  normalizeHouseRoofPitchDegForForm,
  normalizeHouseRoofPitchInputForForm,
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

const HOUSE_ROOF_FORMS: readonly HouseRoofForm[] = ['flat', 'mono', 'hipped'];
const ATTACHMENT_SIDES: readonly AttachmentSide[] = ['rear', 'front', 'left', 'right'];

function buildPresetFootprint(preset: HouseFootprintPreset, attachmentSide: AttachmentSide = 'rear') {
  return buildHouseFootprintPolygon({
    pergolaWidthMm: 6000,
    pergolaDepthMm: 1800,
    preset,
    attachmentSide,
  });
}

describe('house roof validation', () => {
  it('normalizes hipped roof pitches to a visible minimum (gable retired in session C)', () => {
    for (const roofForm of ['hipped'] as const) {
      expect(normalizeHouseRoofPitchInputForForm({ roofForm, value: '' }), roofForm).toBe(
        String(MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG),
      );
      expect(normalizeHouseRoofPitchInputForForm({ roofForm, value: '0' }), roofForm).toBe(
        String(MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG),
      );
      expect(normalizeHouseRoofPitchInputForForm({ roofForm, value: '-1' }), roofForm).toBe(
        String(MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG),
      );
      expect(normalizeHouseRoofPitchInputForForm({ roofForm, value: '3.5' }), roofForm).toBe(
        String(MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG),
      );
      expect(normalizeHouseRoofPitchInputForForm({ roofForm, value: '7.5' }), roofForm).toBe('7.5');
      expect(
        normalizeHouseRoofPitchDegForForm({
          roofForm,
          pitchDeg: 0,
          fallbackPitchDeg: 25,
        }),
        roofForm,
      ).toBe(MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG);
    }

    expect(normalizeHouseRoofPitchInputForForm({ roofForm: 'flat', value: '18' })).toBe('0');
    expect(normalizeHouseRoofPitchInputForForm({ roofForm: 'mono', value: '0' })).toBe('0');
  });

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

  it('supports hipped roofs on every preset and attachment side (gable retired in session C; legacy gable storage maps to hipped at the normalize boundary)', () => {
    for (const attachmentSide of ATTACHMENT_SIDES) {
      for (const preset of HOUSE_FOOTPRINT_PRESETS) {
        const footprint = buildPresetFootprint(preset, attachmentSide);

        for (const roofForm of ['hipped'] as const) {
          const geometryKind = deriveHouseRoofGeometryKind({ roofForm, footprint });
          const capabilities = deriveHouseRoofCapabilities({ roofForm, footprint });
          const validation = validateHouseRoofSelection({
            roofForm,
            footprint,
            appendageEnabled: false,
            roofRidgeAxis: 'x',
          });

          expect(geometryKind, `${preset}/${attachmentSide}/${roofForm} geometry kind`).not.toBeNull();
          expect(capabilities.selectedFormSupported, `${preset}/${attachmentSide}/${roofForm} supported`).toBe(
            true,
          );
          expect(validation.code, `${preset}/${attachmentSide}/${roofForm} validation code`).toBeNull();
          expect(validation.status, `${preset}/${attachmentSide}/${roofForm} validation status`).toBe('valid');
        }
      }
    }
  });

  it('keeps unsupported non-orthogonal custom hipped forms blocked', () => {
    const polygonalFootprint = [
      { x: 0, y: -1800, z: 0 },
      { x: 6000, y: -1800, z: 0 },
      { x: 4200, y: 600, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];

    const capabilities = deriveHouseRoofCapabilities({
      roofForm: 'hipped',
      footprint: polygonalFootprint,
    });
    const validation = validateHouseRoofSelection({
      roofForm: 'hipped',
      footprint: polygonalFootprint,
      appendageEnabled: false,
      roofRidgeAxis: 'x',
    });

    expect(capabilities.footprintTopology).toBe('polygonal');
    expect(capabilities.selectedFormSupported).toBe(false);
    expect(validation.status).toBe('invalid');
    expect(validation.blockedBy).toBe('selected_form');
    expect(validation.code).toBe('unsupported_hipped_topology');
  });
});
