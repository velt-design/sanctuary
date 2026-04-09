import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot, type EstimateDrawingField } from '@/lib/estimates/drawingEdits';
import {
  applyGeometryEditIntent,
  buildGeometryEditState,
  translateEstimateDrawingFieldToGeometryIntent,
  translateFootprintEditToGeometryIntent,
} from './geometryEditAdapter';

function getFixtureSnapshot(slug: 'mono-standard' | 'gable-standard' | 'box-standard') {
  const fixture = getSanctuaryGeometryWorkbenchFixture(slug);
  if (!fixture) throw new Error(`Missing fixture: ${slug}`);
  return fixture.snapshot;
}

describe('geometryEditAdapter', () => {
  it('builds geometry-backed edit state from the effective draft snapshot', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const result = buildGeometryEditState({
      snapshot,
      moduleIndex: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.family).toBe('mono');
    expect(result.value.dimensions.lengthM).toBe('6');
    expect(result.value.dimensions.projectionM).toBe('3');
    expect(result.value.connection.type).toBe('soffit');
    expect(result.value.supports.postCount).toBe('4');
    expect(result.value.overrides.frontBeamProfile).toBe('');
  });

  it('applies family switch edits through the geometry adapter and updates underlying draft fields', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const result = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'family',
        value: 'box',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.inputs.modules[0]?.pergolaStyle).toBe('pitched');
    expect(result.draft.inputs.modules[0]?.boxPerimeterEnabled).toBe(true);
  });

  it('translates drawing-field and footprint edits into geometry intents and produces the next draft', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const lengthField: EstimateDrawingField = {
      id: 'plan:lengthA',
      label: 'Plan length',
      rawValue: '6',
      displayValue: '6.00m',
      svgFieldId: 'plan:lengthA',
      editor: 'singleline',
      target: { type: 'module_input', moduleIndex: 0, field: 'lengthM' },
    };

    const lengthIntent = translateEstimateDrawingFieldToGeometryIntent(lengthField, '7');
    expect(lengthIntent).toEqual({
      type: 'dimension',
      field: 'lengthM',
      value: '7',
    });

    const lengthResult =
      lengthIntent &&
      applyGeometryEditIntent({
        snapshot,
        draft,
        moduleIndex: 0,
        intent: lengthIntent,
      });

    expect(lengthResult && lengthResult.ok).toBe(true);
    if (!lengthResult || !lengthResult.ok) return;
    expect(lengthResult.draft.inputs.modules[0]?.lengthM).toBe('7');

    const footprintIntent = translateFootprintEditToGeometryIntent({
      type: 'preset',
      preset: 'u_shape',
    });
    expect(footprintIntent).toEqual({
      type: 'footprint_preset',
      value: 'u_shape',
    });

    const footprintResult =
      footprintIntent &&
      applyGeometryEditIntent({
        snapshot,
        draft: lengthResult.draft,
        moduleIndex: 0,
        intent: footprintIntent,
      });

    expect(footprintResult && footprintResult.ok).toBe(true);
    if (!footprintResult || !footprintResult.ok) return;
    expect(footprintResult.draft.inputs.modules[0]?.houseFootprintPreset).toBe('u_shape');

    const nextState = buildGeometryEditState({
      snapshot,
      draft: footprintResult.draft,
      moduleIndex: 0,
    });
    expect(nextState.ok).toBe(true);
    if (!nextState.ok) return;
    expect(nextState.value.dimensions.lengthM).toBe('7');
    expect(nextState.value.houseContext.footprintPreset).toBe('u_shape');
  });

  it('returns no geometry intent for unsupported field targets', () => {
    const unsupportedField: EstimateDrawingField = {
      id: 'meta:note',
      label: 'Drawing note',
      rawValue: 'Draft note',
      displayValue: 'Draft note',
      editor: 'multiline',
      target: { type: 'estimate_note' },
    };

    expect(translateEstimateDrawingFieldToGeometryIntent(unsupportedField, 'Updated')).toBeNull();
  });

  it('applies override edits through the geometry adapter and persists them into the draft', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const result = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'override',
        key: 'ledgerProfile',
        value: '100x50',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.inputs.modules[0]?.overrides?.ledgerProfile).toBe('100x50');

    const nextState = buildGeometryEditState({
      snapshot,
      draft: result.draft,
      moduleIndex: 0,
    });
    expect(nextState.ok).toBe(true);
    if (!nextState.ok) return;
    expect(nextState.value.overrides.ledgerProfile).toBe('100x50');
  });
});
