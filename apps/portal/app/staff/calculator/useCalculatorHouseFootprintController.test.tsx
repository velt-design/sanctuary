import type { Dispatch, SetStateAction } from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultCalculatorInputs, makeDefaultModule } from './calculatorInputs';
import { useCalculatorHouseFootprintController } from './useCalculatorHouseFootprintController';

type FootprintController = ReturnType<typeof useCalculatorHouseFootprintController>;

let latest: FootprintController | null = null;
let values: CalculatorInputs;
const setModuleField = vi.fn();

function controller(): FootprintController {
  if (!latest) throw new Error('House footprint controller probe has not rendered.');
  return latest;
}

const setValues: Dispatch<SetStateAction<CalculatorInputs>> = (update) => {
  values = typeof update === 'function' ? update(values) : update;
};

function resetValues() {
  values = {
    ...makeDefaultCalculatorInputs(),
    modules: [
      {
        ...makeDefaultModule('pergola-1'),
        houseFootprintParams: {
          bandDepthM: '1.8',
          widthM: '8',
          offsetXM: '0',
          setbackM: '0',
          returnRunM: '2.4',
          recessWidthM: '2.4',
          recessDepthM: '1.2',
          leftLegRunM: '2.4',
          rightLegRunM: '2.4',
          sideRunM: '2.4',
        },
      },
      makeDefaultModule('pergola-2'),
    ],
  };
}

function Probe({
  activeModuleIndex = 0,
  canEditByInputs = true,
  editorAvailable = true,
  view = 'plan',
}: {
  activeModuleIndex?: number;
  canEditByInputs?: boolean;
  editorAvailable?: boolean;
  view?: 'plan' | 'section';
}) {
  latest = useCalculatorHouseFootprintController({
    activeModule: values.modules[activeModuleIndex] as CalculatorModuleInputs,
    activeModuleIndex,
    activePergolaId: `pergola-${activeModuleIndex + 1}`,
    canEditByInputs,
    editorAvailable,
    moduleViewsTab: view,
    setValues,
    setModuleField,
  });
  return null;
}

function pointerEvent(type: string, values: { pointerId: number; clientX: number; clientY: number }) {
  const event = new Event(type);
  Object.defineProperties(event, {
    pointerId: { value: values.pointerId },
    clientX: { value: values.clientX },
    clientY: { value: values.clientY },
  });
  return event;
}

function identitySvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.defineProperty(svg, 'getScreenCTM', {
    value: () => ({ inverse: () => ({}) }),
  });
  Object.defineProperty(svg, 'createSVGPoint', {
    value: () => {
      const point = {
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: point.x, y: point.y }),
      };
      return point;
    },
  });
  return svg;
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('useCalculatorHouseFootprintController', () => {
  it('owns edit lifecycle and resets it when the module or view changes', () => {
    resetValues();
    const rendered = renderIntoDocument(<Probe />);

    act(() => controller().editor?.onStartEditing());
    expect(controller().editor?.isEditing).toBe(true);

    act(() => controller().editor?.onAttachmentSideHover('left'));
    expect(controller().editor?.hoveredAttachmentSide).toBe('left');

    rendered.rerender(<Probe activeModuleIndex={1} />);
    expect(controller().editor?.isEditing).toBe(false);
    expect(controller().editor?.hoveredAttachmentSide).toBeNull();

    act(() => controller().editor?.onStartEditing());
    rendered.rerender(<Probe activeModuleIndex={1} view="section" />);
    expect(controller().editor?.isEditing).toBe(false);

    rendered.unmount();
  });

  it('preserves preset, rotation, attachment-side, and parameter writes', () => {
    resetValues();
    const rendered = renderIntoDocument(<Probe />);

    act(() => controller().setHouseFootprintParam('recessDepthM', '1.7'));
    expect(values.modules[0].houseFootprintParams?.recessDepthM).toBe('1.7');
    expect(values.modules[1].houseFootprintParams?.recessDepthM).not.toBe('1.7');

    act(() => controller().editor?.onPresetSelect('u_shape'));
    expect(setModuleField).toHaveBeenCalledWith('houseFootprintPreset', 'u_shape');

    act(() => controller().editor?.onRotate(1));
    expect(setModuleField).toHaveBeenCalledWith('drawingRotationQuarterTurns', 1);

    act(() => controller().editor?.onAttachmentSideSelect('right'));
    expect(setModuleField).toHaveBeenCalledWith('attachmentSide', 'right');
    expect(controller().editor?.hoveredAttachmentSide).toBe('right');

    rendered.unmount();
  });

  it('owns pointer drag projection, snapping, clamping, and cleanup', () => {
    resetValues();
    const rendered = renderIntoDocument(<Probe />);
    const svg = identitySvg();

    act(() => {
      controller().editor?.onSvgMount(svg);
      controller().editor?.onStartEditing();
    });
    act(() => controller().editor?.onHandleDragStart(
      {
        handleId: 'bandDepth',
        axisX: 1,
        axisY: 0,
        scale: 10,
        deltaMultiplier: 1,
        minValueM: 1,
        maxValueM: 3,
      },
      { pointerId: 7, clientX: 0, clientY: 0 },
    ));

    expect(controller().editor?.activeHandleId).toBe('bandDepth');

    act(() => window.dispatchEvent(pointerEvent('pointermove', {
      pointerId: 7,
      clientX: 15,
      clientY: 0,
    })));
    expect(values.modules[0].houseFootprintParams?.bandDepthM).toBe('3.0');

    act(() => window.dispatchEvent(pointerEvent('pointerup', {
      pointerId: 7,
      clientX: 15,
      clientY: 0,
    })));
    expect(controller().editor?.activeHandleId).toBeNull();

    rendered.unmount();
  });

  it('does not start gesture editing outside the established eligibility gate', () => {
    resetValues();
    const rendered = renderIntoDocument(<Probe canEditByInputs={false} />);

    act(() => controller().editor?.onStartEditing());
    expect(controller().editor?.isEditing).toBe(false);

    rendered.unmount();
  });
});
