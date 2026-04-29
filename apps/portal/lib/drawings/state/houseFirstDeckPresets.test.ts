import { describe, expect, it } from 'vitest';
import {
  buildDeckReferenceHousePolygon,
  buildFloatingDeckOutline,
  buildRectangularDeckOutline,
  inferDeckFloatingPresetRectFromOutline,
  inferDeckPresetRectFromOutline,
  resolveDeckPresetGeometry,
  sanitizeDeckPresetRect,
} from './houseFirstDeckPresets';

const HOUSE_POLYGON = [
  { alongM: '0', depthM: '0' },
  { alongM: '8', depthM: '0' },
  { alongM: '8', depthM: '4' },
  { alongM: '0', depthM: '4' },
];

const U_HOUSE_POLYGON = [
  { alongM: '0', depthM: '0' },
  { alongM: '2', depthM: '0' },
  { alongM: '2', depthM: '4' },
  { alongM: '4', depthM: '4' },
  { alongM: '4', depthM: '0' },
  { alongM: '6', depthM: '0' },
  { alongM: '6', depthM: '6' },
  { alongM: '0', depthM: '6' },
];

describe('houseFirstDeckPresets', () => {
  it('builds a deck reference house polygon with footprint offset and setback baked in', () => {
    expect(
      buildDeckReferenceHousePolygon({
        housePolygon: HOUSE_POLYGON,
        footprintParams: {
          offsetXM: '1.25',
          setbackM: '0.75',
        },
      }),
    ).toEqual([
      { alongM: '1.25', depthM: '0.75' },
      { alongM: '9.25', depthM: '0.75' },
      { alongM: '9.25', depthM: '4.75' },
      { alongM: '1.25', depthM: '4.75' },
    ]);
  });

  it('builds attached preset rectangles for all host edges', () => {
    expect(
      buildRectangularDeckOutline({
        housePolygon: HOUSE_POLYGON,
        hostEdgeId: 'rear',
        attached: true,
        presetRect: { widthM: '3', depthM: '2', centerOffsetM: '1' },
      }),
    ).toEqual([
      { alongM: '3.5', depthM: '-2' },
      { alongM: '6.5', depthM: '-2' },
      { alongM: '6.5', depthM: '0' },
      { alongM: '3.5', depthM: '0' },
    ]);
    expect(
      buildRectangularDeckOutline({
        housePolygon: HOUSE_POLYGON,
        hostEdgeId: 'front',
        attached: true,
        presetRect: { widthM: '3', depthM: '2', centerOffsetM: '-1' },
      }),
    ).toEqual([
      { alongM: '1.5', depthM: '4' },
      { alongM: '4.5', depthM: '4' },
      { alongM: '4.5', depthM: '6' },
      { alongM: '1.5', depthM: '6' },
    ]);
    expect(
      buildRectangularDeckOutline({
        housePolygon: HOUSE_POLYGON,
        hostEdgeId: 'left',
        attached: true,
        presetRect: { widthM: '2', depthM: '1.5', centerOffsetM: '0.5' },
      }),
    ).toEqual([
      { alongM: '-1.5', depthM: '1.5' },
      { alongM: '-1.5', depthM: '3.5' },
      { alongM: '0', depthM: '3.5' },
      { alongM: '0', depthM: '1.5' },
    ]);
    expect(
      buildRectangularDeckOutline({
        housePolygon: HOUSE_POLYGON,
        hostEdgeId: 'right',
        attached: true,
        presetRect: { widthM: '2', depthM: '1.5', centerOffsetM: '-0.5' },
      }),
    ).toEqual([
      { alongM: '8', depthM: '0.5' },
      { alongM: '8', depthM: '2.5' },
      { alongM: '9.5', depthM: '2.5' },
      { alongM: '9.5', depthM: '0.5' },
    ]);
  });

  it('preserves oversized attached preset width and along-wall offset while still clamping detached gap', () => {
    expect(
      sanitizeDeckPresetRect({
        housePolygon: HOUSE_POLYGON,
        hostEdgeId: 'rear',
        attached: true,
        presetRect: {
          widthM: '20',
          depthM: '0.1',
          centerOffsetM: '999',
        },
      }),
    ).toEqual({
      widthM: '20',
      depthM: '0.3',
      centerOffsetM: '999',
      detachedGapM: null,
    });

    expect(
      sanitizeDeckPresetRect({
        housePolygon: HOUSE_POLYGON,
        hostEdgeId: 'rear',
        attached: false,
        presetRect: {
          widthM: '',
          depthM: 'abc',
          centerOffsetM: '4',
          detachedGapM: '0.05',
        },
        fallbackPresetRect: {
          widthM: '3.6',
          depthM: '3',
          centerOffsetM: '0.4',
          detachedGapM: '0.6',
        },
      }),
    ).toEqual({
      widthM: '3.6',
      depthM: '3',
      centerOffsetM: '4',
      detachedGapM: '0.2',
    });
  });

  it('infers preset params from legacy detached outlines without moving the deck', () => {
    expect(
      inferDeckPresetRectFromOutline({
        housePolygon: HOUSE_POLYGON,
        hostEdgeId: 'rear',
        attached: false,
        outline: [
          { alongM: '2.2', depthM: '-3.6' },
          { alongM: '5.8', depthM: '-3.6' },
          { alongM: '5.8', depthM: '-0.6' },
          { alongM: '2.2', depthM: '-0.6' },
        ],
      }),
    ).toEqual({
      widthM: '3.6',
      depthM: '3',
      centerOffsetM: '0',
      detachedGapM: '0.6',
    });
  });

  it('anchors oversized attached presets to the selected exact host-edge segment without clamping them to the span', () => {
    expect(
      sanitizeDeckPresetRect({
        housePolygon: U_HOUSE_POLYGON,
        hostEdgeId: 'footprint-edge-1',
        attached: true,
        presetRect: {
          widthM: '10',
          depthM: '2.2',
          centerOffsetM: '0',
        },
      }),
    ).toEqual({
      widthM: '10',
      depthM: '2.2',
      centerOffsetM: '0',
      detachedGapM: null,
    });

    expect(
      buildRectangularDeckOutline({
        housePolygon: U_HOUSE_POLYGON,
        hostEdgeId: 'footprint-edge-1',
        attached: true,
        presetRect: {
          widthM: '10',
          depthM: '2.2',
          centerOffsetM: '0',
        },
      }),
    ).toEqual([
      { alongM: '-4', depthM: '-2.2' },
      { alongM: '6', depthM: '-2.2' },
      { alongM: '6', depthM: '0' },
      { alongM: '-4', depthM: '0' },
    ]);
  });

  it('rebuilds attached presets deterministically when the host edge changes', () => {
    expect(
      buildRectangularDeckOutline({
        housePolygon: U_HOUSE_POLYGON,
        hostEdgeId: 'left',
        attached: true,
        presetRect: {
          widthM: '4',
          depthM: '1.5',
          centerOffsetM: '1',
        },
      }),
    ).toEqual([
      { alongM: '-1.5', depthM: '2' },
      { alongM: '-1.5', depthM: '6' },
      { alongM: '0', depthM: '6' },
      { alongM: '0', depthM: '2' },
    ]);
  });

  it('builds floating preset outlines from local-space world rects', () => {
    expect(
      buildFloatingDeckOutline({
        floatingRect: {
          centerAlongM: '6.5',
          centerDepthM: '5.5',
          widthM: '4',
          depthM: '2',
        },
      }),
    ).toEqual([
      { alongM: '4.5', depthM: '4.5' },
      { alongM: '8.5', depthM: '4.5' },
      { alongM: '8.5', depthM: '6.5' },
      { alongM: '4.5', depthM: '6.5' },
    ]);
  });

  it('infers floating preset rects directly from detached outlines', () => {
    expect(
      inferDeckFloatingPresetRectFromOutline({
        outline: [
          { alongM: '2.2', depthM: '-3.6' },
          { alongM: '5.8', depthM: '-3.6' },
          { alongM: '5.8', depthM: '-0.6' },
          { alongM: '2.2', depthM: '-0.6' },
        ],
      }),
    ).toEqual({
      centerAlongM: '4',
      centerDepthM: '-2.1',
      widthM: '3.6',
      depthM: '3',
    });
  });

  it('hydrates legacy detached presets into floating rects without moving them', () => {
    const legacyOutline = [
      { alongM: '2.2', depthM: '-3.6' },
      { alongM: '5.8', depthM: '-3.6' },
      { alongM: '5.8', depthM: '-0.6' },
      { alongM: '2.2', depthM: '-0.6' },
    ];

    expect(
      resolveDeckPresetGeometry({
        deck: {
          id: 'deck-1',
          shape: 'preset',
          presetType: 'rect_detached',
          hostEdgeId: 'rear',
          isAttached: false,
          outline: legacyOutline,
        },
        housePolygon: HOUSE_POLYGON,
      }),
    ).toEqual({
      hostEdgeId: 'rear',
      attachmentMode: 'floating',
      primaryHostEdgeId: 'rear',
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      presetRect: {
        widthM: '3.6',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
      floatingRect: {
        centerAlongM: '4',
        centerDepthM: '-2.1',
        widthM: '3.6',
        depthM: '3',
      },
      outline: legacyOutline,
    });
  });

  it('uses floating preset rects as the geometry source of truth for detached presets', () => {
    expect(
      resolveDeckPresetGeometry({
        deck: {
          id: 'deck-2',
          shape: 'preset',
          presetType: 'rect_detached',
          hostEdgeId: 'rear',
          isAttached: false,
          presetRect: {
            widthM: '3.6',
            depthM: '3',
            centerOffsetM: '0',
            detachedGapM: '0.6',
          },
          floatingRect: {
            centerAlongM: '7',
            centerDepthM: '5',
            widthM: '4',
            depthM: '2',
          },
        },
        housePolygon: HOUSE_POLYGON,
      }),
    ).toEqual({
      hostEdgeId: 'rear',
      attachmentMode: 'floating',
      primaryHostEdgeId: 'rear',
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      presetRect: {
        widthM: '3.6',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
      floatingRect: {
        centerAlongM: '7',
        centerDepthM: '5',
        widthM: '4',
        depthM: '2',
      },
      outline: [
        { alongM: '5', depthM: '4' },
        { alongM: '9', depthM: '4' },
        { alongM: '9', depthM: '6' },
        { alongM: '5', depthM: '6' },
      ],
    });
  });

  it('builds preset corner-attached outlines from two exact host edges and a saved corner vertex', () => {
    expect(
      buildRectangularDeckOutline({
        housePolygon: U_HOUSE_POLYGON,
        hostEdgeId: 'footprint-edge-2',
        primaryHostEdgeId: 'footprint-edge-2',
        secondaryHostEdgeId: 'footprint-edge-3',
        cornerVertexId: 'footprint-vertex-3',
        attachmentMode: 'corner_dual_edge',
        attached: true,
        presetRect: {
          widthM: '3',
          depthM: '2',
          centerOffsetM: '0',
        },
      }),
    ).toEqual([
      { alongM: '2', depthM: '2' },
      { alongM: '5', depthM: '2' },
      { alongM: '5', depthM: '4' },
      { alongM: '2', depthM: '4' },
    ]);
  });

  it('falls back to the semantic right wall when a saved exact host edge id resolves to a different side', () => {
    expect(
      resolveDeckPresetGeometry({
        deck: {
          id: 'deck-right-release',
          shape: 'preset',
          presetType: 'rect_attached',
          hostEdgeId: 'right',
          primaryHostEdgeId: 'footprint-edge-1',
          isAttached: true,
          presetRect: {
            widthM: '2',
            depthM: '1.5',
            centerOffsetM: '-0.5',
          },
          outline: [],
        },
        housePolygon: HOUSE_POLYGON,
      }),
    ).toEqual({
      hostEdgeId: 'right',
      attachmentMode: 'single_edge',
      primaryHostEdgeId: 'right',
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      presetRect: {
        widthM: '2',
        depthM: '1.5',
        centerOffsetM: '-0.5',
        detachedGapM: null,
      },
      floatingRect: null,
      outline: [
        { alongM: '8', depthM: '0.5' },
        { alongM: '8', depthM: '2.5' },
        { alongM: '9.5', depthM: '2.5' },
        { alongM: '9.5', depthM: '0.5' },
      ],
    });
  });
});
