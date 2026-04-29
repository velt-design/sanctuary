import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot } from '@/lib/estimates/drawingEdits';
import { buildHouseFirstWorkbenchProjectModel } from './houseFirstWorkbenchAdapter';
import type { HouseFirstWorkbenchProjectModel } from './houseFirstWorkbenchModel';
import { buildObjectFirstWorkbenchProjectModel } from './objectFirstWorkbenchAdapter';

function loadFixtureProject(slug = 'mono-standard'): HouseFirstWorkbenchProjectModel {
  const fixture = getSanctuaryGeometryWorkbenchFixture(slug);
  if (!fixture) {
    throw new Error(`Missing fixture: ${slug}`);
  }
  return buildHouseFirstWorkbenchProjectModel({
    snapshot: fixture.snapshot,
    draft: fixture.draft,
  });
}

describe('buildObjectFirstWorkbenchProjectModel', () => {
  it('maps a compatibility project without a house to a null house assembly', () => {
    const project = buildObjectFirstWorkbenchProjectModel({
      compatibilityProjectModel: {
        source: 'legacy_estimate_snapshot',
        house: null,
        pergolas: [],
        warnings: [],
      },
    });

    expect(project.source).toBe('legacy_estimate_snapshot');
    expect(project.houseAssembly).toBeNull();
    expect(project.decks).toEqual([]);
    expect(project.openings).toEqual([]);
    expect(project.pergolas).toEqual([]);
    expect(project.warnings).toEqual([]);
  });

  it('maps the compatibility house into one stable house form and keeps the derived envelope', () => {
    const compatibilityProject = loadFixtureProject();
    const project = buildObjectFirstWorkbenchProjectModel({
      compatibilityProjectModel: compatibilityProject,
    });
    const house = compatibilityProject.house;

    if (!house) {
      throw new Error('Expected fixture house.');
    }

    expect(project.houseAssembly).toMatchObject({
      id: 'assembly-main',
      label: house.label,
      derivedEnvelope: house.derivedEnvelope,
    });
    expect(project.houseAssembly?.houseForms).toHaveLength(1);
    expect(project.houseAssembly?.houseForms[0]).toMatchObject({
      id: house.id,
      label: house.label,
      transform: {
        offsetXM: 0,
        offsetYM: 0,
        rotationQuarterTurns: house.footprint.drawingRotationQuarterTurns,
      },
      footprint: {
        mode: house.footprint.mode,
        preset: house.footprint.preset,
        attachmentSide: house.footprint.attachmentSide,
      },
      roofIntent: {
        form: house.roof.form,
        material: house.roof.material,
        primaryPitchDeg: house.roof.primaryPitchDeg,
        primaryFallDirection: house.roof.primaryFallDirection,
        ridgeAxis: house.roof.ridgeAxis,
      },
      sourceModuleIndexes: house.sourceModuleIndexes,
      sourceModuleIds: house.sourceModuleIds,
    });
    expect(project.houseAssembly?.houseForms[0]?.footprint.params).toBe(house.footprint.params);
    expect(project.houseAssembly?.houseForms[0]?.footprint.polygon).toBe(house.footprint.polygon);
  });

  it('copies compatibility decks, openings, and pergolas into authored object arrays', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) {
      throw new Error('Missing mono-standard fixture.');
    }
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) {
      throw new Error('Expected fixture draft.');
    }
    draft.houseFirst = {
      ...(draft.houseFirst ?? {}),
      decks: [
        {
          id: 'deck-1',
          name: 'Rear deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          hostEdgeId: 'rear',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
        },
      ],
      openings: [
        {
          id: 'opening-1',
          label: 'Slider',
          kind: 'slider',
          panelCount: 3,
          wallId: 'rear',
          hostEdgeId: 'footprint-edge-1',
          widthM: '2.4',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '1.2',
        },
      ],
      pergolas: [
        {
          id: 'pergola-1',
          attachmentEdgeId: 'footprint-edge-1',
          attachmentZoneId: 'zone-soffit-footprint-edge-1',
        },
      ],
    };
    const compatibilityProject = buildHouseFirstWorkbenchProjectModel({
      snapshot: fixture.snapshot,
      draft,
    });
    const project = buildObjectFirstWorkbenchProjectModel({
      compatibilityProjectModel: compatibilityProject,
    });

    expect(project.decks[0]).toMatchObject({
      id: 'deck-1',
      label: 'Rear deck',
      kind: 'deck',
      shape: 'preset',
      presetType: 'rect_attached',
      elevationMode: 'aligned_to_threshold',
      hostEdgeId: 'rear',
      isAttached: true,
      surfaceMaterial: 'timber_decking',
    });
    expect(project.openings[0]).toMatchObject({
      id: 'opening-1',
      label: 'Slider',
      kind: 'slider',
      panelCount: 3,
      sourceFormId: compatibilityProject.house?.id,
      widthM: '2.4',
      heightM: '2.1',
      offsetAlongWallM: '1.2',
    });
    expect(project.openings[0]?.hostWallId).toMatch(/^wall-footprint-edge-/);
    expect(project.pergolas[0]).toMatchObject({
      id: 'pergola-1',
      attachmentEdgeId: 'footprint-edge-1',
      attachmentZoneId: 'zone-soffit-footprint-edge-1',
    });
  });

  it('preserves compatibility warning messages', () => {
    const compatibilityProject = loadFixtureProject('gable-standard');
    const warning = {
      id: 'warning-1',
      code: 'conflicting_house_field' as const,
      severity: 'blocking' as const,
      field: 'houseFirst.roof.form',
      chosenModuleIndex: 0,
      conflictingModuleIndexes: [1],
      message: 'Compatibility warning message.',
    };
    const project = buildObjectFirstWorkbenchProjectModel({
      compatibilityProjectModel: {
        ...compatibilityProject,
        warnings: [warning],
      },
    });

    expect(project.warnings).toEqual(['Compatibility warning message.']);
  });
});
