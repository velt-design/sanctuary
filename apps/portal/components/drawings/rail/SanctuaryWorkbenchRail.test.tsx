import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ObjectWorkbenchGeometryEditState } from '@/lib/drawings/geometry/geometryEditAdapter';
import SanctuaryWorkbenchRail from './SanctuaryWorkbenchRail';

function makeGeometryState(
  overrides: Omit<Partial<ObjectWorkbenchGeometryEditState>, 'dimensions' | 'roof' | 'connection' | 'houseContext'> & {
    dimensions?: Partial<ObjectWorkbenchGeometryEditState['dimensions']>;
    roof?: Partial<ObjectWorkbenchGeometryEditState['roof']>;
    connection?: Partial<ObjectWorkbenchGeometryEditState['connection']>;
    houseContext?: Partial<ObjectWorkbenchGeometryEditState['houseContext']>;
  } = {},
): ObjectWorkbenchGeometryEditState {
  const base: ObjectWorkbenchGeometryEditState = {
    family: 'mono',
    config: {} as ObjectWorkbenchGeometryEditState['config'],
    dimensions: {
      lengthM: '6',
      projectionM: '3',
      hipCornerLengthBM: '0',
      hipCornerProjectionBM: '0',
    },
    roof: {
      material: 'acrylic',
      pitchDeg: '25',
      boxPerimeterEnabled: false,
      mixedAcrylicBaysMain: '0',
      mixedAcrylicBaysA: '0',
      mixedAcrylicBaysB: '0',
    },
    connection: {
      type: 'fascia',
      attachmentSide: 'rear',
    },
    houseContext: {
      canEditFootprint: true,
      footprintMode: 'preset',
      footprintPreset: 'straight',
      footprintParams: {
        widthM: '',
        offsetXM: '0',
        setbackM: '0',
        bandDepthM: '1.8',
        returnRunM: '2.4',
        recessWidthM: '2.4',
        recessDepthM: '1.2',
        leftLegRunM: '2.4',
        rightLegRunM: '2.4',
        sideRunM: '2.4',
      },
      footprintPolygon: [],
      drawingRotationQuarterTurns: 1,
      attachmentStrategy: 'auto',
      storeyMode: 'single_storey',
      roofMaterial: 'corrugated_iron',
      eaveHeightM: '2.4',
      wallHeightM: '2.4',
      roofPitchDeg: '25',
      soffitDepthMm: '450',
      fasciaHeightMm: '180',
      gutterWidthMm: '125',
      gutterDepthMm: '90',
      gutterProjectionMm: '125',
      eaveOverhangMm: '450',
    },
    supports: {
      postConnectionType: 'slab_anchors',
      ground: 'easy',
      postCount: '2',
      postCutHeightM: '2.5',
    },
    gable: null,
    overrides: {
      ledgerProfile: '',
      rafterProfile: '',
      postProfile: '',
      frontBeamProfile: '',
      ridgeBeamProfile: '',
      boxPerimeterBeamProfile: '',
      tieBeamProfile: '',
      strutProfile: '',
    },
  };

  return {
    ...base,
    ...overrides,
    dimensions: { ...base.dimensions, ...overrides.dimensions },
    roof: { ...base.roof, ...overrides.roof },
    connection: { ...base.connection, ...overrides.connection },
    houseContext: {
      ...base.houseContext,
      ...overrides.houseContext,
      footprintParams: {
        ...base.houseContext.footprintParams,
        ...(overrides.houseContext?.footprintParams ?? {}),
      },
    },
    supports: { ...base.supports, ...overrides.supports },
    gable: overrides.gable ?? base.gable,
  };
}

function selectMarkup(markup: string, label: string): string {
  const marker = `aria-label="${label}"`;
  const markerIndex = markup.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Missing select: ${label}`);
  }
  const start = markup.lastIndexOf('<select', markerIndex);
  const end = markup.indexOf('</select>', markerIndex);
  return markup.slice(start, end);
}

describe('SanctuaryWorkbenchRail', () => {
  it('renders only the curated Sanctuary sections and hides calculator sprawl', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Mono"
        geometryState={makeGeometryState()}
        view="plan"
        canStartDrawOutline
        onStartDrawOutline={() => ({ ok: true })}
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('Geometry');
    expect(markup).toContain('Roof');
    expect(markup).toContain('House / Context');
    expect(markup).toContain('Supports');
    expect(markup).toContain('Pergola family');
    expect(markup).toContain('Box perimeter');
    expect(markup).toContain('Roof material');
    // PR-T7 (2026-05-29): House connection / Attachment strategy / Storey
    // mode dropdowns removed (dead writes — values derive from model).
    expect(markup).not.toContain('House connection');
    expect(markup).not.toContain('Attachment strategy');
    expect(markup).not.toContain('Storey mode');
    expect(markup).toContain('Eave height');
    expect(markup).toContain('Fascia height');
    expect(markup).toContain('House width');
    expect(markup).toContain('House offset X');
    expect(markup).toContain('Facade setback');
    expect(markup).toContain('Post count');
    expect(markup).toContain('Overrides');
    expect(markup).toContain('>Ledger<');
    expect(markup).toContain('>Rafters<');
    expect(markup).toContain('>Posts<');
    expect(markup).not.toContain('Flashings');
    expect(markup).not.toContain('Allowances');
    expect(markup).not.toContain('Travel');
    expect(markup).not.toContain('Powdercoat');
    expect(markup).not.toContain('Open full calculator');
  });

  it('shows ground only for pile footings and disables roof pitch when box perimeter is active', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Box"
        geometryState={makeGeometryState({
          family: 'box',
          roof: {
            material: 'acrylic',
            pitchDeg: '5',
            boxPerimeterEnabled: true,
          },
          supports: {
            postConnectionType: 'pile_1m',
            ground: 'easy',
            postCount: '2',
            postCutHeightM: '2.5',
          },
        })}
        view="plan"
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('Ground');
    expect(markup).toContain('aria-label="Roof pitch"');
    expect(markup).toContain('>Box perimeter beam<');
    expect(markup).toContain('disabled=""');
  });

  it('renders the house-context dimension fields with their effective values', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Mono"
        geometryState={makeGeometryState({
          houseContext: {
            attachmentStrategy: 'auto',
            storeyMode: 'single_storey',
            eaveHeightM: '2.4',
            wallHeightM: '2.4',
            roofPitchDeg: '25',
            soffitDepthMm: '450',
            fasciaHeightMm: '180',
            gutterWidthMm: '125',
            gutterDepthMm: '90',
            gutterProjectionMm: '125',
            eaveOverhangMm: '450',
          },
        })}
        view="plan"
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    // PR-T7 (2026-05-29): House connection / Attachment strategy / Storey
    // mode dropdowns culled; only the editable dimension fields stay.
    expect(markup).toContain('aria-label="Eave height"');
    expect(markup).toContain('value="2.4"');
    expect(markup).toContain('aria-label="Soffit depth"');
    expect(markup).toContain('value="450"');
    expect(markup).toContain('aria-label="Gutter projection"');
    expect(markup).toContain('aria-label="House width"');
    expect(markup).toContain('aria-label="House offset X"');
    expect(markup).toContain('aria-label="Facade setback"');
    expect(markup).toContain('Blank matches the pergola length.');
  });

  it('disables house dimension controls for freestanding modules', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Mono"
        geometryState={makeGeometryState({
          connection: {
            type: 'freestanding',
            attachmentSide: 'rear',
          },
          houseContext: {
            canEditFootprint: true,
          },
        })}
        view="plan"
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    // PR-T7 (2026-05-29): freestanding disables the house model dimension
    // fields. The strategy / storey dropdowns this test used to assert
    // against were culled.
    expect(markup).toContain('aria-label="Eave height"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-label="House width"');
  });

  it('shows gable-only overrides and editable attached gable end frames', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M2 - Gable"
        geometryState={makeGeometryState({
          family: 'gable',
          roof: {
            material: 'acrylic',
            pitchDeg: '25',
            boxPerimeterEnabled: false,
          },
          gable: {
            endFramesMode: 'none',
            houseEaveGutterMode: 'house',
            outerEaveGutterMode: 'our',
          },
        })}
        view="plan"
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('Gable Baseline');
    expect(markup).toContain('Gable end frames');
    // PR-T7 (2026-05-29): gable eave gutter readouts removed (were
    // disabled-no-op dropdowns).
    expect(markup).not.toContain('House-side eave gutter');
    expect(markup).not.toContain('Outer-side eave gutter');
    expect(markup).toContain('End frames are editable. Eave gutter modes are constrained to the supported gable baseline.');
    expect(selectMarkup(markup, 'Gable end frames')).not.toContain('disabled=""');
    expect(selectMarkup(markup, 'Gable end frames')).toContain('value="none"');
    expect(selectMarkup(markup, 'Gable end frames')).toContain('value="outer_end_only"');
    expect(selectMarkup(markup, 'Gable end frames')).toContain('value="both_ends"');
    expect(markup).toContain('>Tie beam<');
    expect(markup).toContain('>King-post strut<');
    expect(markup).not.toContain('>Box perimeter beam<');
  });

  it('shows the freestanding supported gable baseline when the connection is freestanding', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M2 - Gable"
        geometryState={makeGeometryState({
          family: 'gable',
          connection: {
            type: 'freestanding',
            attachmentSide: 'rear',
          },
          gable: {
            endFramesMode: 'none',
            houseEaveGutterMode: 'our',
            outerEaveGutterMode: 'our',
          },
        })}
        view="plan"
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    // PR-T7 (2026-05-29): gable eave gutter readouts removed; only the
    // editable Gable end frames field remains in the gable section.
    expect(markup).toContain('Gable Baseline');
    expect(selectMarkup(markup, 'Gable end frames')).not.toContain('disabled=""');
    expect(selectMarkup(markup, 'Gable end frames')).toContain('value="none"');
    expect(selectMarkup(markup, 'Gable end frames')).toContain('value="both_ends"');
    expect(selectMarkup(markup, 'Gable end frames')).not.toContain('value="outer_end_only"');
  });

  it('keeps draw outline locked to the model-space plan editor', () => {
    const sectionMarkup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Mono"
        geometryState={makeGeometryState()}
        view="section"
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );
    const sectionModeSelect = selectMarkup(sectionMarkup, 'House footprint mode');

    expect(sectionModeSelect).toContain('value="custom_polygon" disabled=""');
    expect(sectionMarkup).toContain('Use Model Space &gt; Plan to draw the outline.');

    const planMarkup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Mono"
        geometryState={makeGeometryState()}
        view="plan"
        canStartDrawOutline
        onStartDrawOutline={() => ({ ok: true })}
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    expect(selectMarkup(planMarkup, 'House footprint mode')).toContain('value="custom_polygon"');
    expect(selectMarkup(planMarkup, 'House footprint mode')).not.toContain('value="custom_polygon" disabled=""');
  });
});
