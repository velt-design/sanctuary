import { describe, expect, it } from 'vitest';
import type { EstimateDrawingField } from '@/lib/estimates/drawingEdits';
import {
  formatPlanFieldResizeValue,
  resolvePlanFieldResizeDrag,
  startPlanFieldResizeDrag,
  type PlanFieldResizeDragMeta,
  type PlanFieldResizeDimensions,
} from './planFieldResizeController';

function makePlanDimensions(input?: Partial<PlanFieldResizeDimensions>): PlanFieldResizeDimensions {
  return {
    lengthA: input?.lengthA ?? 6,
    spanA: input?.spanA ?? 3,
  };
}

function makeField(id: string, rawValue = '5'): EstimateDrawingField {
  return {
    id,
    label: id,
    rawValue,
    displayValue: rawValue,
    editor: 'singleline',
    target: { type: 'estimate_note' },
  };
}

function makeMeta(input?: Partial<PlanFieldResizeDragMeta>): PlanFieldResizeDragMeta {
  return {
    fieldId: input?.fieldId ?? 'plan:lengthA',
    axisX: input?.axisX ?? 1,
    axisY: input?.axisY ?? 0,
    scale: input?.scale ?? 100,
    deltaMultiplier: input?.deltaMultiplier ?? 1,
    minValueM: input?.minValueM ?? 1,
    maxValueM: input?.maxValueM ?? 10,
  };
}

describe('planFieldResizeController', () => {
  it('starts resize sessions for editable length and span fields', () => {
    const lengthField = makeField('plan:lengthA', '7');
    const spanField = makeField('plan:spanA', '4');
    const fields = new Map<string, EstimateDrawingField>([
      ['plan:lengthA', lengthField],
      ['plan:spanA', spanField],
    ]);

    const length = startPlanFieldResizeDrag({
      available: true,
      geometryPlanDimensions: makePlanDimensions(),
      editableFieldMap: fields,
      meta: makeMeta({ fieldId: 'plan:lengthA' }),
      pointerId: 12,
      startSvgPoint: { x: 20, y: 30 },
    });
    const span = startPlanFieldResizeDrag({
      available: true,
      geometryPlanDimensions: makePlanDimensions(),
      editableFieldMap: fields,
      meta: makeMeta({ fieldId: 'plan:spanA' }),
      pointerId: 13,
      startSvgPoint: { x: 25, y: 35 },
    });

    expect(length.ok).toBe(true);
    expect(length.ok ? length.session.field : null).toBe(lengthField);
    expect(length.ok ? length.session.startValueM : null).toBe(7);
    expect(length.ok ? length.session.pointerId : null).toBe(12);
    expect(span.ok).toBe(true);
    expect(span.ok ? span.session.field : null).toBe(spanField);
    expect(span.ok ? span.session.startValueM : null).toBe(4);
  });

  it('rejects disabled, missing plan, and missing field starts', () => {
    const fields = new Map<string, EstimateDrawingField>([['plan:lengthA', makeField('plan:lengthA')]]);

    expect(
      startPlanFieldResizeDrag({
        available: false,
        geometryPlanDimensions: makePlanDimensions(),
        editableFieldMap: fields,
        meta: makeMeta(),
        pointerId: 1,
        startSvgPoint: { x: 0, y: 0 },
      }),
    ).toEqual({ ok: false, reason: 'editing_unavailable' });
    expect(
      startPlanFieldResizeDrag({
        available: true,
        geometryPlanDimensions: null,
        legacyPlanDimensions: null,
        editableFieldMap: fields,
        meta: makeMeta(),
        pointerId: 1,
        startSvgPoint: { x: 0, y: 0 },
      }),
    ).toEqual({ ok: false, reason: 'missing_plan_dimensions' });
    expect(
      startPlanFieldResizeDrag({
        available: true,
        geometryPlanDimensions: makePlanDimensions(),
        editableFieldMap: new Map(),
        meta: makeMeta(),
        pointerId: 1,
        startSvgPoint: { x: 0, y: 0 },
      }),
    ).toEqual({ ok: false, reason: 'missing_field' });
  });

  it('uses geometry plan dimensions when the editable field raw value is not numeric', () => {
    const length = startPlanFieldResizeDrag({
      available: true,
      geometryPlanDimensions: makePlanDimensions({ lengthA: 8, spanA: 4 }),
      editableFieldMap: new Map([['plan:lengthA', makeField('plan:lengthA', 'not-number')]]),
      meta: makeMeta({ fieldId: 'plan:lengthA' }),
      pointerId: 1,
      startSvgPoint: { x: 0, y: 0 },
    });
    const span = startPlanFieldResizeDrag({
      available: true,
      geometryPlanDimensions: makePlanDimensions({ lengthA: 8, spanA: 4 }),
      editableFieldMap: new Map([['plan:spanA', makeField('plan:spanA', 'not-number')]]),
      meta: makeMeta({ fieldId: 'plan:spanA' }),
      pointerId: 1,
      startSvgPoint: { x: 0, y: 0 },
    });

    expect(length.ok ? length.session.startValueM : null).toBe(8);
    expect(span.ok ? span.session.startValueM : null).toBe(4);
  });

  it('uses explicitly named legacy dimensions only when geometry dimensions are unavailable', () => {
    const start = startPlanFieldResizeDrag({
      available: true,
      legacyPlanDimensions: makePlanDimensions({ lengthA: 9, spanA: 2 }),
      editableFieldMap: new Map([['plan:lengthA', makeField('plan:lengthA', 'not-number')]]),
      meta: makeMeta({ fieldId: 'plan:lengthA' }),
      pointerId: 1,
      startSvgPoint: { x: 0, y: 0 },
    });

    expect(start.ok ? start.session.startValueM : null).toBe(9);
  });

  it('converts SVG deltas through axes, scale, and multiplier', () => {
    const start = startPlanFieldResizeDrag({
      available: true,
      geometryPlanDimensions: makePlanDimensions(),
      editableFieldMap: new Map([['plan:lengthA', makeField('plan:lengthA', '5')]]),
      meta: makeMeta({ axisX: 0, axisY: 1, scale: 50, deltaMultiplier: -1 }),
      pointerId: 1,
      startSvgPoint: { x: 10, y: 10 },
    });

    const result = resolvePlanFieldResizeDrag({
      session: start.ok ? start.session : null,
      nextSvgPoint: { x: 100, y: 60 },
    });

    expect(result.kind).toBe('field_commit');
    expect(result.kind === 'field_commit' ? result.nextValueM : null).toBe(4);
    expect(result.kind === 'field_commit' ? result.nextValue : null).toBe('4');
  });

  it('clamps to min and max resize values', () => {
    const start = startPlanFieldResizeDrag({
      available: true,
      geometryPlanDimensions: makePlanDimensions(),
      editableFieldMap: new Map([['plan:lengthA', makeField('plan:lengthA', '5')]]),
      meta: makeMeta({ minValueM: 3, maxValueM: 6 }),
      pointerId: 1,
      startSvgPoint: { x: 0, y: 0 },
    });

    const tooHigh = resolvePlanFieldResizeDrag({
      session: start.ok ? start.session : null,
      nextSvgPoint: { x: 500, y: 0 },
    });
    const tooLow = resolvePlanFieldResizeDrag({
      session: start.ok ? start.session : null,
      nextSvgPoint: { x: -500, y: 0 },
    });

    expect(tooHigh.kind === 'field_commit' ? tooHigh.nextValue : null).toBe('6');
    expect(tooLow.kind === 'field_commit' ? tooLow.nextValue : null).toBe('3');
  });

  it('uses the current drawing field value format', () => {
    expect(formatPlanFieldResizeValue(1.23456)).toBe('1.235');
    expect(formatPlanFieldResizeValue(2.5)).toBe('2.5');
    expect(formatPlanFieldResizeValue(0)).toBe('0');
  });
});
