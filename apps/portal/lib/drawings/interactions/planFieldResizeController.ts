import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import type { EstimateDrawingField } from '@/lib/estimates/drawingEdits';

export type PlanFieldResizeFieldId = 'plan:lengthA' | 'plan:spanA';

export type PlanFieldResizeDragMeta = {
  fieldId: PlanFieldResizeFieldId;
  axisX: number;
  axisY: number;
  scale: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
};

export type PlanFieldResizeSvgPoint = {
  x: number;
  y: number;
};

export type PlanFieldResizeDragSession = PlanFieldResizeDragMeta & {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startValueM: number;
  field: EstimateDrawingField;
};

export type PlanFieldResizeStartResult =
  | {
      ok: true;
      session: PlanFieldResizeDragSession;
    }
  | {
      ok: false;
      reason: 'editing_unavailable' | 'missing_plan_model' | 'missing_field';
    };

export type PlanFieldResizeDragResult =
  | {
      kind: 'field_commit';
      field: EstimateDrawingField;
      nextValue: string;
      nextValueM: number;
    }
  | {
      kind: 'invalid' | 'noop';
      reason: 'missing_session' | 'missing_point';
    };

export function formatPlanFieldResizeValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

export function startPlanFieldResizeDrag(input: {
  available: boolean;
  planModel?: Pick<ModulePlanModel, 'lengthA' | 'spanA'> | null;
  editableFieldMap: ReadonlyMap<string, EstimateDrawingField>;
  meta: PlanFieldResizeDragMeta;
  pointerId: number;
  startSvgPoint: PlanFieldResizeSvgPoint;
}): PlanFieldResizeStartResult {
  if (!input.available) return { ok: false, reason: 'editing_unavailable' };
  if (!input.planModel) return { ok: false, reason: 'missing_plan_model' };
  const field = input.editableFieldMap.get(input.meta.fieldId);
  if (!field) return { ok: false, reason: 'missing_field' };

  const fallbackValue = input.meta.fieldId === 'plan:lengthA' ? input.planModel.lengthA : input.planModel.spanA;
  const startValueM = Number.parseFloat(field.rawValue);

  return {
    ok: true,
    session: {
      ...input.meta,
      pointerId: input.pointerId,
      startSvgX: input.startSvgPoint.x,
      startSvgY: input.startSvgPoint.y,
      startValueM: Number.isFinite(startValueM) ? startValueM : fallbackValue,
      field,
    },
  };
}

export function resolvePlanFieldResizeDrag(input: {
  session: PlanFieldResizeDragSession | null;
  nextSvgPoint: PlanFieldResizeSvgPoint | null;
}): PlanFieldResizeDragResult {
  if (!input.session) return { kind: 'noop', reason: 'missing_session' };
  if (!input.nextSvgPoint) return { kind: 'invalid', reason: 'missing_point' };

  const deltaSvgX = input.nextSvgPoint.x - input.session.startSvgX;
  const deltaSvgY = input.nextSvgPoint.y - input.session.startSvgY;
  const deltaUnits = deltaSvgX * input.session.axisX + deltaSvgY * input.session.axisY;
  const deltaM = (deltaUnits / Math.max(input.session.scale, 0.001)) * input.session.deltaMultiplier;
  const unclampedValueM = input.session.startValueM + deltaM;
  const nextValueM = Number.isFinite(input.session.maxValueM)
    ? Math.min(Math.max(unclampedValueM, input.session.minValueM), input.session.maxValueM)
    : Math.max(unclampedValueM, input.session.minValueM);

  return {
    kind: 'field_commit',
    field: input.session.field,
    nextValue: formatPlanFieldResizeValue(nextValueM),
    nextValueM,
  };
}
