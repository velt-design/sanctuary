import { describe, expect, it } from 'vitest';
import { buildWorkbenchDeckSupportDiagnostic } from './deckSupportDiagnostics';
import { makeHouseFirstDeckSupportProjectFixture } from './houseFirstWorkbenchFixtures';

describe('buildWorkbenchDeckSupportDiagnostic', () => {
  it('treats attached threshold decks on the active host side as positive evidence', () => {
    const fixture = makeHouseFirstDeckSupportProjectFixture({
      id: 'rear_threshold_attached',
    });

    const diagnostic = buildWorkbenchDeckSupportDiagnostic({
      activeHostSide: fixture.activeHostSide,
      decks: fixture.projectModel.house?.decks ?? [],
    });

    expect(diagnostic.hasRelevantDeck).toBe(true);
    expect(diagnostic.resolvedClassification).toBe('threshold_attached');
    expect(diagnostic.deckBracketEligible).toBe(true);
    expect(diagnostic.positiveDeckIds).toEqual(['deck-rear-threshold']);
  });

  it('matches side-attached decks only on the same side', () => {
    const sideFixture = makeHouseFirstDeckSupportProjectFixture({
      id: 'left_threshold_attached',
    });
    const rearFixture = makeHouseFirstDeckSupportProjectFixture({
      id: 'left_non_relevant_when_rear_active',
    });

    const matching = buildWorkbenchDeckSupportDiagnostic({
      activeHostSide: sideFixture.activeHostSide,
      decks: sideFixture.projectModel.house?.decks ?? [],
    });
    const nonMatching = buildWorkbenchDeckSupportDiagnostic({
      activeHostSide: rearFixture.activeHostSide,
      decks: rearFixture.projectModel.house?.decks ?? [],
    });

    expect(matching.resolvedClassification).toBe('threshold_attached');
    expect(matching.deckBracketEligible).toBe(true);
    expect(nonMatching.hasRelevantDeck).toBe(false);
    expect(nonMatching.resolvedClassification).toBe('none');
  });

  it('keeps detached decks ineligible while preserving advisory warnings on attached decks', () => {
    const detachedFixture = makeHouseFirstDeckSupportProjectFixture({
      id: 'detached_rear_near_house',
    });
    const warningFixture = makeHouseFirstDeckSupportProjectFixture({
      id: 'rear_warning_heavy_attached',
    });

    const detached = buildWorkbenchDeckSupportDiagnostic({
      activeHostSide: detachedFixture.activeHostSide,
      decks: detachedFixture.projectModel.house?.decks ?? [],
    });
    const warningHeavy = buildWorkbenchDeckSupportDiagnostic({
      activeHostSide: warningFixture.activeHostSide,
      decks: warningFixture.projectModel.house?.decks ?? [],
    });

    expect(detached.hasRelevantDeck).toBe(true);
    expect(detached.resolvedClassification).toBe('ground_supported');
    expect(detached.deckBracketEligible).toBe(false);
    expect(detached.warningCodes).toContain('detached_too_close_to_house');

    expect(warningHeavy.resolvedClassification).toBe('threshold_attached');
    expect(warningHeavy.deckBracketEligible).toBe(true);
    expect(warningHeavy.warningCodes).toEqual(
      expect.arrayContaining(['threshold_alignment_offset', 'insufficient_host_edge_contact']),
    );
  });

  it('treats host-edge and nearest-edge matches as relevant for wrap-style contexts', () => {
    const fixture = makeHouseFirstDeckSupportProjectFixture({
      id: 'rear_wrap_multi_edge',
    });

    const rear = buildWorkbenchDeckSupportDiagnostic({
      activeHostSide: 'rear',
      decks: fixture.projectModel.house?.decks ?? [],
    });
    const left = buildWorkbenchDeckSupportDiagnostic({
      activeHostSide: 'left',
      decks: fixture.projectModel.house?.decks ?? [],
    });

    expect(rear.relevantDeckIds).toEqual(['deck-rear-wrap']);
    expect(left.relevantDeckIds).toEqual(['deck-rear-wrap']);
    expect(left.resolvedClassification).toBe('threshold_attached');
  });
});
