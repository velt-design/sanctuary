import { describe, expect, it } from 'vitest';
import {
  makeHouseFirstConflictingLegacyContextFixture,
  makeHouseFirstDeckSupportProjectFixture,
  makeHouseFirstDeckSupportSnapshotFixture,
  makeHouseFirstOnePergolaFixture,
  makeHouseFirstTwoPergolaSharedHouseFixture,
} from './houseFirstWorkbenchFixtures';

describe('houseFirstWorkbenchFixtures', () => {
  it('provides a one-pergola shared house fixture', () => {
    const fixture = makeHouseFirstOnePergolaFixture();

    expect(fixture.houseForms[0]?.id).toBe('house-main');
    expect(fixture.pergolas).toHaveLength(1);
    expect(fixture.houseForms[0]?.roof.form).toBe('mono');
    expect(fixture.houseForms[0]?.attachmentZoneDiagnostics.blocked).toEqual([]);
  });

  it('provides a two-pergola shared house fixture', () => {
    const fixture = makeHouseFirstTwoPergolaSharedHouseFixture();

    expect(fixture.pergolas).toHaveLength(2);
    expect(fixture.houseForms[0]?.attachmentZones).toHaveLength(1);
  });

  it('provides a conflicting legacy house-context snapshot fixture', () => {
    const fixture = makeHouseFirstConflictingLegacyContextFixture();
    const modules = (fixture.snapshot.inputs as { modules: Array<{ houseFootprintPreset?: string }> }).modules;

    expect(modules).toHaveLength(2);
    expect(modules[0]?.houseFootprintPreset).toBe('straight');
    expect(modules[1]?.houseFootprintPreset).toBe('u_shape');
  });

  it('provides the shared-house deck support fixture matrix', () => {
    const rear = makeHouseFirstDeckSupportProjectFixture({ id: 'rear_threshold_attached' });
    const left = makeHouseFirstDeckSupportProjectFixture({ id: 'left_threshold_attached' });
    const detached = makeHouseFirstDeckSupportProjectFixture({ id: 'detached_rear_near_house' });
    const wrap = makeHouseFirstDeckSupportProjectFixture({ id: 'rear_wrap_multi_edge' });
    const nonRelevant = makeHouseFirstDeckSupportProjectFixture({ id: 'left_non_relevant_when_rear_active' });
    const warningHeavy = makeHouseFirstDeckSupportProjectFixture({ id: 'rear_warning_heavy_attached' });

    expect(rear.projectModel.houseForms[0]?.decks[0]?.supportContext.classification).toBe('threshold_attached');
    expect(left.activeHostSide).toBe('left');
    expect(detached.projectModel.houseForms[0]?.decks[0]?.supportContext.classification).toBe('ground_supported');
    expect(wrap.projectModel.houseForms[0]?.decks[0]?.supportContext.nearestHouseEdgeId).toBe('left');
    expect(nonRelevant.projectModel.houseForms[0]?.decks[0]?.hostEdgeId).toBe('left');
    expect(warningHeavy.projectModel.houseForms[0]?.decks[0]?.supportContext.warningCodes).toContain(
      'insufficient_host_edge_contact',
    );
  });

  it('provides snapshot-backed deck support fixtures for store and preview tests', () => {
    const attached = makeHouseFirstDeckSupportSnapshotFixture('rear_threshold_attached');
    const side = makeHouseFirstDeckSupportSnapshotFixture('left_threshold_attached');
    const detached = makeHouseFirstDeckSupportSnapshotFixture('detached_rear_near_house');

    expect(attached.draft.objectFirst?.decks?.[0]?.hostEdgeId).toBe('rear');
    expect(side.draft.inputs.modules[0]?.attachmentSide).toBe('left');
    expect(detached.draft.objectFirst?.decks?.[0]?.presetType).toBe('rect_detached');
  });
});
