import { describe, expect, it } from 'vitest';
import { makeDefaultHouseFootprintParams } from '@/lib/types/calculator';
import type {
  HouseFirstRoofDraft,
  HouseRoofForm,
} from './houseFirstWorkbenchModel';
import {
  resolveHouseRoofProjection,
  roofFormAcceptsOpenGableEnds,
  roofFormHasRidgeAxis,
  type ResolveHouseRoofProjectionInput,
} from './houseRoofFormAdapter';

// Focused tests for the three Dutch-hip-style gate predicates. These
// are the rules that caused three separate "openGableEndIds disappeared
// on commit" bugs during the Dutch-hip rollout -- each one was a
// `sharedRoofForm === 'gable'`-style mistake that survived because the
// inline gate had no test surface. The integration test
// (`houseFirstWorkbenchAdapter.test.ts`) confirms end-to-end behaviour;
// these tests pin each predicate so a future regression fails one
// focused assertion rather than a 1.6k-line integration run.

const RECTANGLE_4x3_M = [
  { alongM: '0', depthM: '0' },
  { alongM: '4', depthM: '0' },
  { alongM: '4', depthM: '3' },
  { alongM: '0', depthM: '3' },
];

function baseInput(overrides: Partial<ResolveHouseRoofProjectionInput> = {}): ResolveHouseRoofProjectionInput {
  return {
    roofDraft: null,
    derivedHousePolygon: RECTANGLE_4x3_M,
    normalizedFootprintMode: 'preset',
    normalizedFootprintPreset: 'straight',
    normalizedFootprintParams: makeDefaultHouseFootprintParams(),
    normalizedAttachmentSide: 'rear',
    attachmentKind: 'freestanding',
    attachmentStrategy: null,
    normalizedRoofMaterial: 'corrugated_iron',
    roofMaterialSource: 'legacy_shared_value',
    roofPitchSource: 'legacy_shared_value',
    inferredPrimaryPitchDeg: '5',
    roofForm: 'mono',
    firstModuleLengthMm: 4000,
    firstModuleProjectionMm: 3000,
    eaveHeightM: '2.4',
    eaveOverhangMm: '450',
    ...overrides,
  };
}

function draftWithForm(form: HouseRoofForm, openGableEndIds?: string[]): HouseFirstRoofDraft {
  return {
    form,
    material: 'corrugated_iron',
    primaryPitchDeg: form === 'mono' ? '5' : '22',
    primaryFallDirection: null,
    ridgeAxis: null,
    openGableEndIds: openGableEndIds ?? null,
  };
}

describe('roof form gate predicates', () => {
  // Pin each predicate to exactly the forms it accepts. These three
  // gates have shipped wrong before -- their isolation here is the
  // primary value of the houseRoofFormAdapter extraction.

  it('roofFormAcceptsOpenGableEnds is true for hipped only', () => {
    expect(roofFormAcceptsOpenGableEnds('hipped')).toBe(true);
    expect(roofFormAcceptsOpenGableEnds('mono')).toBe(false);
    expect(roofFormAcceptsOpenGableEnds('flat')).toBe(false);
  });

  // PR-T8 (2026-05-29): `roofFormAcceptsAppendage` retired with the appendage cull.

  it('roofFormHasRidgeAxis is true for hipped only', () => {
    expect(roofFormHasRidgeAxis('hipped')).toBe(true);
    expect(roofFormHasRidgeAxis('mono')).toBe(false);
    expect(roofFormHasRidgeAxis('flat')).toBe(false);
  });
});

describe('resolveHouseRoofProjection — openGableEndIds gate', () => {
  it('preserves valid openGableEndIds when form is hipped', () => {
    const projection = resolveHouseRoofProjection(
      baseInput({
        roofDraft: draftWithForm('hipped', ['terminal-end-1']),
      }),
    );
    expect(projection.roof.form).toBe('hipped');
    // Whether the specific id survives depends on the actual terminal
    // ends derived from the polygon — assert at least that hipped
    // doesn't unconditionally clear the requested set.
    const intersection = projection.roof.openGableEndIds.filter(
      (id) => id === 'terminal-end-1',
    );
    const requestedExists = projection.roof.terminalEnds.some(
      (end) => end.id === 'terminal-end-1',
    );
    expect(intersection.length).toBe(requestedExists ? 1 : 0);
  });

  it('drops openGableEndIds when form is mono (gate closed)', () => {
    const projection = resolveHouseRoofProjection(
      baseInput({
        roofDraft: draftWithForm('mono', ['terminal-end-1']),
      }),
    );
    expect(projection.roof.form).toBe('mono');
    expect(projection.roof.openGableEndIds).toEqual([]);
  });

  it('drops openGableEndIds when form is flat (gate closed)', () => {
    const projection = resolveHouseRoofProjection(
      baseInput({
        roofDraft: draftWithForm('flat', ['terminal-end-1']),
        roofForm: 'flat',
      }),
    );
    expect(projection.roof.form).toBe('flat');
    expect(projection.roof.openGableEndIds).toEqual([]);
  });
});

// PR-T8 (2026-05-29): "resolveHouseRoofProjection — appendage gate" suite
// removed alongside the appendage feature cull.

describe('resolveHouseRoofProjection — provenance and source tagging', () => {
  it('tags source=legacy_module_inference when no explicit draft fields are set', () => {
    const projection = resolveHouseRoofProjection(baseInput({ roofDraft: null }));
    expect(projection.roof.source).toBe('legacy_module_inference');
    expect(projection.roof.provenance!.form).toBe('legacy_pergola_inference');
  });

  it('tags source=house_first_draft when the draft sets the form', () => {
    const projection = resolveHouseRoofProjection(
      baseInput({
        roofDraft: draftWithForm('hipped'),
      }),
    );
    expect(projection.roof.source).toBe('house_first_draft');
    expect(projection.roof.provenance!.form).toBe('house_first_draft');
  });

  it('tags openGableEndIds provenance as house_first_draft only when the draft includes them', () => {
    const without = resolveHouseRoofProjection(
      baseInput({ roofDraft: draftWithForm('hipped', undefined) }),
    );
    // `draftWithForm` returns openGableEndIds: null when undefined is passed.
    // null is NOT an array, so provenance falls back to default.
    expect(without.roof.provenance!.openGableEndIds).toBe('default_fallback');

    const withList = resolveHouseRoofProjection(
      baseInput({ roofDraft: draftWithForm('hipped', []) }),
    );
    // Empty array is still an array — explicit intent to clear all opens.
    expect(withList.roof.provenance!.openGableEndIds).toBe('house_first_draft');
  });
});

describe('resolveHouseRoofProjection — confidence default', () => {
  it('returns confidence=high by default (adapter overlays low when applicable)', () => {
    const projection = resolveHouseRoofProjection(baseInput());
    expect(projection.roof.confidence).toBe('high');
  });
});

describe('resolveHouseRoofProjection — warnings', () => {
  it('emits no warnings for the happy path', () => {
    const projection = resolveHouseRoofProjection(baseInput());
    expect(projection.warnings).toEqual([]);
  });

  it('emits a blocking warning when custom_polygon openGableEndIds reference unknown ends', () => {
    const projection = resolveHouseRoofProjection(
      baseInput({
        normalizedFootprintMode: 'custom_polygon',
        roofForm: 'hipped',
        roofDraft: draftWithForm('hipped', ['definitely-not-a-real-end-id']),
      }),
    );
    const warning = projection.warnings.find(
      (entry) => entry.id === 'house-roof-open-gable-ends',
    );
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('blocking');
  });
});
