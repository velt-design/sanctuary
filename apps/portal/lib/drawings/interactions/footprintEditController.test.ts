import { describe, expect, it } from 'vitest';
import type { CalculatorHouseFootprintParams, CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import {
  buildFootprintAttachmentSideIntent,
  buildFootprintModeIntent,
  buildFootprintPresetIntent,
  buildFootprintRotateIntent,
  resolveFootprintEdgeAddIntent,
  resolveFootprintHandleDragIntent,
  resolveFootprintVertexDeleteIntent,
  resolveFootprintVertexDragIntent,
} from './footprintEditController';

function makeParams(overrides: Partial<CalculatorHouseFootprintParams> = {}): CalculatorHouseFootprintParams {
  return {
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
    ...overrides,
  };
}

function makePolygon(): CalculatorHouseFootprintPolygonPoint[] {
  return [
    { alongM: '0', depthM: '0' },
    { alongM: '4', depthM: '0' },
    { alongM: '4', depthM: '2' },
    { alongM: '0', depthM: '2' },
  ];
}

describe('footprintEditController', () => {
  it('routes preset, rotate, and attachment side controls to footprint edits', () => {
    expect(buildFootprintPresetIntent('straight')).toMatchObject({
      kind: 'footprint_edit',
      edit: { type: 'preset', preset: 'straight' },
    });
    expect(buildFootprintRotateIntent(1)).toMatchObject({
      kind: 'footprint_edit',
      edit: { type: 'rotate', delta: 1 },
    });
    expect(buildFootprintAttachmentSideIntent('front')).toMatchObject({
      kind: 'footprint_edit',
      edit: { type: 'attachment_side', side: 'front' },
    });
  });

  it('starts draw-outline instead of committing when switching to custom polygon mode', () => {
    expect(buildFootprintModeIntent('custom_polygon')).toEqual({ kind: 'start_draw_outline' });
    expect(buildFootprintModeIntent('preset')).toMatchObject({
      kind: 'footprint_edit',
      edit: { type: 'mode', mode: 'preset' },
    });
  });

  it('converts footprint handle drags to the same clamped param edits', () => {
    const intent = resolveFootprintHandleDragIntent({
      session: {
        handleId: 'bandDepth',
        startSvgX: 0,
        startSvgY: 0,
        axisX: 1,
        axisY: 0,
        scale: 100,
        deltaMultiplier: 1,
        minValueM: 0.5,
        maxValueM: 12,
        startParams: makeParams({ bandDepthM: '1.8' }),
      },
      nextSvgPoint: { x: 120, y: 0 },
    });

    expect(intent).toMatchObject({
      kind: 'footprint_edit',
      edit: { type: 'param', key: 'bandDepthM', value: '3' },
    });
  });

  it('moves a custom footprint vertex in local polygon space', () => {
    const intent = resolveFootprintVertexDragIntent({
      session: {
        vertexIndex: 1,
        startSvgX: 0,
        startSvgY: 0,
        alongAxisX: 1,
        alongAxisY: 0,
        depthAxisX: 0,
        depthAxisY: 1,
        scale: 100,
        startPolygon: makePolygon(),
      },
      nextSvgPoint: { x: 50, y: -25 },
    });

    expect(intent).toMatchObject({
      kind: 'footprint_edit',
      edit: {
        type: 'polygon',
        polygon: [
          { alongM: '0', depthM: '0' },
          { alongM: '4.5', depthM: '-0.25' },
          { alongM: '4', depthM: '2' },
          { alongM: '0', depthM: '2' },
        ],
      },
    });
  });

  it('adds and deletes custom footprint polygon vertices', () => {
    expect(resolveFootprintEdgeAddIntent({ polygon: makePolygon(), edgeIndex: 0 })).toMatchObject({
      kind: 'footprint_edit',
      edit: {
        type: 'polygon',
        polygon: [
          { alongM: '0', depthM: '0' },
          { alongM: '2', depthM: '0' },
          { alongM: '4', depthM: '0' },
          { alongM: '4', depthM: '2' },
          { alongM: '0', depthM: '2' },
        ],
      },
    });
    expect(resolveFootprintVertexDeleteIntent({ polygon: makePolygon(), vertexIndex: 2 })).toMatchObject({
      kind: 'footprint_edit',
      edit: {
        type: 'polygon',
        polygon: [
          { alongM: '0', depthM: '0' },
          { alongM: '4', depthM: '0' },
          { alongM: '0', depthM: '2' },
        ],
      },
    });
  });
});
