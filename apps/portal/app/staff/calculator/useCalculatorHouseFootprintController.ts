'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AttachmentSide } from '@sp/costing';
import type {
  CalculatorHouseFootprintParams,
  CalculatorInputs,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import {
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
} from '@/lib/types/calculator';
import { makeDefaultModule } from './calculatorInputs';
import type {
  HouseFootprintEditorDragMeta,
  HouseFootprintHandleId,
  ModuleViewsTab,
} from './ModuleViewsCard';

type HouseFootprintDragSession = HouseFootprintEditorDragMeta & {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startParams: CalculatorHouseFootprintParams;
};

type CalculatorModuleFieldSetter = <K extends keyof CalculatorModuleInputs>(
  key: K,
  next: CalculatorModuleInputs[K],
) => void;

type UseCalculatorHouseFootprintControllerOptions = {
  activeModule: CalculatorModuleInputs;
  activeModuleIndex: number;
  activePergolaId: string;
  canEditByInputs: boolean;
  editorAvailable: boolean;
  moduleViewsTab: ModuleViewsTab;
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
  setModuleField: CalculatorModuleFieldSetter;
};

function formatHouseFootprintParamValue(value: number): string {
  return value.toFixed(1);
}

function parseHouseFootprintParamValue(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function snapHouseFootprintValue(value: number): number {
  return Math.round(value * 10) / 10;
}

function clientPointToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

export function useCalculatorHouseFootprintController({
  activeModule,
  activeModuleIndex,
  activePergolaId,
  canEditByInputs,
  editorAvailable,
  moduleViewsTab,
  setValues,
  setModuleField,
}: UseCalculatorHouseFootprintControllerOptions) {
  const [isEditing, setIsEditing] = useState(false);
  const [hoveredAttachmentSide, setHoveredAttachmentSide] = useState<AttachmentSide | null>(null);
  const [hoveredHandleId, setHoveredHandleId] = useState<HouseFootprintHandleId | null>(null);
  const [activeHandleId, setActiveHandleId] = useState<HouseFootprintHandleId | null>(null);
  const [dragSession, setDragSession] = useState<HouseFootprintDragSession | null>(null);
  const canvasSvgRef = useRef<SVGSVGElement | null>(null);
  const drawingRotationQuarterTurns = normalizeDrawingRotationQuarterTurns(
    activeModule.drawingRotationQuarterTurns,
  );

  const setHouseFootprintParam = (key: keyof CalculatorHouseFootprintParams, value: string) => {
    setValues((previous) => {
      const modules = previous.modules.slice();
      const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      modules[activeModuleIndex] = {
        ...current,
        houseFootprintParams: {
          ...normalizeHouseFootprintParams(current.houseFootprintParams),
          [key]: value,
        },
      };
      return { ...previous, modules };
    });
  };

  const onSvgMount = useCallback((node: SVGSVGElement | null) => {
    canvasSvgRef.current = node;
  }, []);

  const stopEditing = useCallback(() => {
    setIsEditing(false);
    setHoveredAttachmentSide(null);
    setHoveredHandleId(null);
    setActiveHandleId(null);
    setDragSession(null);
  }, []);

  useEffect(() => {
    stopEditing();
  }, [activeModuleIndex, stopEditing]);

  useEffect(() => {
    if (editorAvailable && moduleViewsTab === 'plan') return;
    stopEditing();
  }, [editorAvailable, moduleViewsTab, stopEditing]);

  const startEditing = useCallback(() => {
    if (!canEditByInputs || moduleViewsTab !== 'plan') return;
    setIsEditing(true);
  }, [canEditByInputs, moduleViewsTab]);

  const onPresetSelect = useCallback(
    (preset: CalculatorModuleInputs['houseFootprintPreset']) => {
      setHoveredHandleId(null);
      setActiveHandleId(null);
      setDragSession(null);
      setModuleField(
        'houseFootprintPreset',
        normalizeHouseFootprintPreset(preset) as CalculatorModuleInputs['houseFootprintPreset'],
      );
    },
    [setModuleField],
  );

  const onRotate = useCallback(
    (delta: -1 | 1) => {
      const nextTurns = normalizeDrawingRotationQuarterTurns(drawingRotationQuarterTurns + delta);
      setHoveredAttachmentSide(null);
      setHoveredHandleId(null);
      setActiveHandleId(null);
      setDragSession(null);
      setModuleField(
        'drawingRotationQuarterTurns',
        nextTurns as CalculatorModuleInputs['drawingRotationQuarterTurns'],
      );
    },
    [drawingRotationQuarterTurns, setModuleField],
  );

  const onAttachmentSideSelect = useCallback(
    (side: AttachmentSide) => {
      setHoveredAttachmentSide(side);
      setHoveredHandleId(null);
      setActiveHandleId(null);
      setDragSession(null);
      setModuleField('attachmentSide', side as CalculatorModuleInputs['attachmentSide']);
    },
    [setModuleField],
  );

  const onHandleDragStart = useCallback(
    (
      meta: HouseFootprintEditorDragMeta,
      event: { pointerId: number; clientX: number; clientY: number },
    ) => {
      if (!canEditByInputs || !isEditing) return;
      const svg = canvasSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;
      setActiveHandleId(meta.handleId);
      setHoveredHandleId(meta.handleId);
      setDragSession({
        ...meta,
        pointerId: event.pointerId,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startParams: normalizeHouseFootprintParams(activeModule.houseFootprintParams),
      });
    },
    [activeModule.houseFootprintParams, canEditByInputs, isEditing],
  );

  useEffect(() => {
    if (!dragSession) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragSession.pointerId) return;
      const svg = canvasSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;

      const deltaSvgX = nextPoint.x - dragSession.startSvgX;
      const deltaSvgY = nextPoint.y - dragSession.startSvgY;
      const deltaUnits = deltaSvgX * dragSession.axisX + deltaSvgY * dragSession.axisY;
      const deltaM = (deltaUnits / Math.max(dragSession.scale, 0.001)) * dragSession.deltaMultiplier;
      const minValueM = dragSession.minValueM;
      const maxValueM = Math.max(minValueM, dragSession.maxValueM);
      const startParams = dragSession.startParams;

      let nextKey: keyof CalculatorHouseFootprintParams = 'bandDepthM';
      let nextValue = parseHouseFootprintParamValue(startParams.bandDepthM, 1.8) + deltaM;

      switch (dragSession.handleId) {
        case 'returnRun':
          nextKey = 'returnRunM';
          nextValue = parseHouseFootprintParamValue(startParams.returnRunM, 2.4) + deltaM;
          break;
        case 'recessWidth':
          nextKey = 'recessWidthM';
          nextValue = parseHouseFootprintParamValue(startParams.recessWidthM, 2.4) + deltaM;
          break;
        case 'recessDepth':
          nextKey = 'recessDepthM';
          nextValue = parseHouseFootprintParamValue(startParams.recessDepthM, 1.2) + deltaM;
          break;
        case 'leftLegRun':
          nextKey = 'leftLegRunM';
          nextValue = parseHouseFootprintParamValue(startParams.leftLegRunM, 2.4) + deltaM;
          break;
        case 'rightLegRun':
          nextKey = 'rightLegRunM';
          nextValue = parseHouseFootprintParamValue(startParams.rightLegRunM, 2.4) + deltaM;
          break;
        case 'sideRun':
          nextKey = 'sideRunM';
          nextValue = parseHouseFootprintParamValue(startParams.sideRunM, 2.4) + deltaM;
          break;
        case 'bandDepth':
        default:
          nextKey = 'bandDepthM';
          nextValue = parseHouseFootprintParamValue(startParams.bandDepthM, 1.8) + deltaM;
          break;
      }

      nextValue = snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM));
      setHouseFootprintParam(nextKey, formatHouseFootprintParamValue(nextValue));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== dragSession.pointerId) return;
      setDragSession(null);
      setActiveHandleId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [dragSession, setHouseFootprintParam]);

  return {
    drawingRotationQuarterTurns,
    setHouseFootprintParam,
    editor: editorAvailable ? {
      available: true as const,
      isEditing,
      allowAttachmentSideCanvasSelect: true,
      allowResizeEdgeDrag: true,
      hoveredAttachmentSide,
      hoveredHandleId,
      activeHandleId,
      onStartEditing: startEditing,
      onDoneEditing: stopEditing,
      onAttachmentSideHover: setHoveredAttachmentSide,
      onAttachmentSideSelect,
      onHandleHover: setHoveredHandleId,
      onHandleDragStart,
      onPresetSelect,
      onRotate,
      onSvgMount,
    } : undefined,
  };
}
