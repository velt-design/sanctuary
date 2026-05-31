import { describe, expect, it } from 'vitest';
import type {
  ObjectFirstHouseFormDraft,
  ObjectFirstWorkbenchDraftVNext,
} from './objectFirstWorkbenchModel';
import {
  addHouseFormToObjectFirstDraft,
  nextHouseFormId,
  removeHouseFormFromObjectFirstDraft,
  resolveNextHouseFormIdAfterRemoval,
} from './objectFirstWorkbenchAdapter';

function makePrimaryHouseFormDraft(
  overrides: Partial<ObjectFirstHouseFormDraft> = {},
): ObjectFirstHouseFormDraft {
  return {
    id: 'house-main',
    label: 'House',
    transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
    footprint: {
      mode: 'preset',
      preset: 'straight',
      params: { widthM: '8', bandDepthM: '6' } as ObjectFirstHouseFormDraft['footprint']['params'],
      polygon: [],
      attachmentSide: 'rear',
    },
    roofIntent: {
      form: 'mono',
      material: 'corrugated_iron',
      primaryPitchDeg: '5',
      primaryFallDirection: 'negative_y',
      ridgeAxis: 'x',
      openGableEndIds: [],
    } as ObjectFirstHouseFormDraft['roofIntent'],
    storeyMode: 'single_storey',
    attachmentStrategy: null,
    ...overrides,
  };
}

function makeSingleFormDraft(
  formOverrides: Partial<ObjectFirstHouseFormDraft> = {},
): ObjectFirstWorkbenchDraftVNext {
  return {
    houseAssembly: {
      id: 'assembly-main',
      label: 'House Assembly',
      houseForms: [makePrimaryHouseFormDraft(formOverrides)],
    },
    decks: [],
    openings: [],
    pergolas: [],
  };
}

function makeEmptyHouseAssemblyDraft(): ObjectFirstWorkbenchDraftVNext {
  return {
    houseAssembly: {
      id: 'assembly-main',
      label: 'House Assembly',
      houseForms: [],
    },
    decks: [],
    openings: [],
    pergolas: [],
  };
}

describe('nextHouseFormId', () => {
  it('starts at house-form-1 for explicit zero-house assemblies', () => {
    expect(nextHouseFormId([])).toBe('house-form-1');
  });

  it('keeps imported house-main as an ordinary existing id', () => {
    expect(nextHouseFormId([{ id: 'house-main' }])).toBe('house-form-2');
  });

  it('skips already-used ids so a removed-then-added form does not collide', () => {
    expect(
      nextHouseFormId([
        { id: 'house-main' },
        { id: 'house-form-2' },
        { id: 'house-form-3' },
      ]),
    ).toBe('house-form-4');
  });

  it('does NOT backfill gaps -- starts at length+1 then steps past collisions (matches deck/opening pattern)', () => {
    // Existing forms: [house-main, house-form-4]. length+1 = 3. Slot 3
    // is free, so the next id is house-form-3 (NOT house-form-2). This
    // mirrors `nextObjectWorkbenchDeckId` / `nextObjectWorkbenchOpeningId`
    // -- gap-filling would confuse the user ("I deleted house-form-3,
    // why is my new one suddenly called that?").
    expect(
      nextHouseFormId([{ id: 'house-main' }, { id: 'house-form-4' }]),
    ).toBe('house-form-3');
  });
});

describe('addHouseFormToObjectFirstDraft', () => {
  it('appends a cloned form with a fresh id and a default 10m east offset', () => {
    const result = addHouseFormToObjectFirstDraft({ draft: makeSingleFormDraft() });
    expect(result.houseAssembly!.houseForms).toHaveLength(2);
    const [primary, added] = result.houseAssembly!.houseForms;
    expect(primary!.id).toBe('house-main');
    expect(added!.id).toBe('house-form-2');
    expect(added!.label).toBe('House 2');
    // 10m east of the source so the new form doesn't sit on top of it
    // in plan view. Y and rotation are inherited from the source.
    expect(added!.transform).toEqual({
      offsetXM: 10,
      offsetYM: 0,
      rotationQuarterTurns: 0,
    });
  });

  it('clones the source forms footprint and roof intent (defaults are editable, never undefined)', () => {
    const result = addHouseFormToObjectFirstDraft({ draft: makeSingleFormDraft() });
    const [, added] = result.houseAssembly!.houseForms;
    expect(added!.footprint.preset).toBe('straight');
    expect(added!.footprint.attachmentSide).toBe('rear');
    expect(added!.roofIntent.form).toBe('mono');
  });

  it('honours a label override', () => {
    const result = addHouseFormToObjectFirstDraft({
      draft: makeSingleFormDraft(),
      label: 'Sleepout',
    });
    expect(result.houseAssembly!.houseForms.at(-1)!.label).toBe('Sleepout');
  });

  it('honours a transform override (e.g. position the new form to the south)', () => {
    const result = addHouseFormToObjectFirstDraft({
      draft: makeSingleFormDraft(),
      transformOverride: { offsetXM: 0, offsetYM: 12, rotationQuarterTurns: 1 },
    });
    expect(result.houseAssembly!.houseForms.at(-1)!.transform).toEqual({
      offsetXM: 0,
      offsetYM: 12,
      rotationQuarterTurns: 1,
    });
  });

  it('clones from a non-primary source when sourceHouseFormId is set', () => {
    const seeded = addHouseFormToObjectFirstDraft({
      draft: makeSingleFormDraft(),
      label: 'Garage',
      transformOverride: { offsetXM: 20, offsetYM: 0, rotationQuarterTurns: 0 },
    });
    const result = addHouseFormToObjectFirstDraft({
      draft: seeded,
      sourceHouseFormId: 'house-form-2',
    });
    // The new form clones from house-form-2 (offsetXM=20) and adds 10
    // east -> offsetXM=30 -- proves the clone took its source's transform,
    // not the primary's (which is at offsetXM=0).
    expect(result.houseAssembly!.houseForms.at(-1)!.transform.offsetXM).toBe(30);
  });

  it('creates a deterministic first form when the assembly is empty', () => {
    const result = addHouseFormToObjectFirstDraft({ draft: makeEmptyHouseAssemblyDraft() });
    expect(result.houseAssembly!.houseForms).toHaveLength(1);
    expect(result.houseAssembly!.houseForms[0]).toMatchObject({
      id: 'house-form-1',
      label: 'House 1',
      transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
      footprint: { mode: 'preset', preset: 'straight', attachmentSide: 'rear' },
      roofIntent: { form: 'mono', material: 'corrugated_iron' },
    });
  });

  it('creates a house assembly when no houseAssembly is present', () => {
    const empty: ObjectFirstWorkbenchDraftVNext = {
      houseAssembly: null,
      decks: [],
      openings: [],
      pergolas: [],
    };
    const result = addHouseFormToObjectFirstDraft({ draft: empty });
    expect(result.houseAssembly!.houseForms.map((form) => form.id)).toEqual(['house-form-1']);
  });
});

describe('removeHouseFormFromObjectFirstDraft', () => {
  it('removes the matching form from houseAssembly.houseForms', () => {
    const seeded = addHouseFormToObjectFirstDraft({ draft: makeSingleFormDraft() });
    expect(seeded.houseAssembly!.houseForms).toHaveLength(2);
    const result = removeHouseFormFromObjectFirstDraft({
      draft: seeded,
      houseFormId: 'house-form-2',
    });
    expect(result.houseAssembly!.houseForms).toHaveLength(1);
    expect(result.houseAssembly!.houseForms[0]!.id).toBe('house-main');
  });

  it('removes the first form and leaves the remaining form as a peer', () => {
    const seeded = addHouseFormToObjectFirstDraft({ draft: makeSingleFormDraft() });
    const result = removeHouseFormFromObjectFirstDraft({
      draft: seeded,
      houseFormId: 'house-main',
    });
    expect(result.houseAssembly!.houseForms.map((form) => form.id)).toEqual(['house-form-2']);
  });

  it('removes the last remaining form and preserves an explicit empty assembly', () => {
    const draft = makeSingleFormDraft();
    const result = removeHouseFormFromObjectFirstDraft({
      draft,
      houseFormId: 'house-main',
    });
    expect(result).not.toBe(draft);
    expect(result.houseAssembly).toMatchObject({
      id: 'assembly-main',
      label: 'House Assembly',
      houseForms: [],
    });
  });

  it('no-ops when the id does not match any form', () => {
    const draft = makeSingleFormDraft();
    const result = removeHouseFormFromObjectFirstDraft({
      draft,
      houseFormId: 'house-form-99',
    });
    expect(result).toBe(draft);
  });
});

describe('resolveNextHouseFormIdAfterRemoval', () => {
  it('selects the form now occupying the removed index', () => {
    expect(
      resolveNextHouseFormIdAfterRemoval(
        [{ id: 'house-main' }, { id: 'house-form-2' }, { id: 'house-form-3' }],
        'house-main',
      ),
    ).toBe('house-form-2');
  });

  it('selects the previous form when the removed form was last', () => {
    expect(
      resolveNextHouseFormIdAfterRemoval(
        [{ id: 'house-main' }, { id: 'house-form-2' }, { id: 'house-form-3' }],
        'house-form-3',
      ),
    ).toBe('house-form-2');
  });

  it('clears selection when removing the only form and reports missing ids distinctly', () => {
    expect(resolveNextHouseFormIdAfterRemoval([{ id: 'house-main' }], 'house-main')).toBeNull();
    expect(resolveNextHouseFormIdAfterRemoval([{ id: 'house-main' }], 'house-form-99')).toBeUndefined();
  });
});

describe('add -> remove -> add round-trip', () => {
  it('reuses the freed id slot after a remove (no orphaned ids)', () => {
    // Add house-form-2.
    const afterAdd1 = addHouseFormToObjectFirstDraft({ draft: makeSingleFormDraft() });
    expect(afterAdd1.houseAssembly!.houseForms.at(-1)!.id).toBe('house-form-2');
    // Remove it.
    const afterRemove = removeHouseFormFromObjectFirstDraft({
      draft: afterAdd1,
      houseFormId: 'house-form-2',
    });
    expect(afterRemove.houseAssembly!.houseForms).toHaveLength(1);
    // Add again -- id 2 is free, so the next-id generator picks it again.
    const afterAdd2 = addHouseFormToObjectFirstDraft({ draft: afterRemove });
    expect(afterAdd2.houseAssembly!.houseForms.at(-1)!.id).toBe('house-form-2');
  });

  it('starts over at house-form-1 after removing every house form', () => {
    const afterRemove = removeHouseFormFromObjectFirstDraft({
      draft: makeSingleFormDraft(),
      houseFormId: 'house-main',
    });
    const afterAdd = addHouseFormToObjectFirstDraft({ draft: afterRemove });
    expect(afterAdd.houseAssembly!.houseForms.map((form) => form.id)).toEqual(['house-form-1']);
  });
});
