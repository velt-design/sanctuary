import { describe, expect, it } from 'vitest';
import type { InfillLineItem } from '@/lib/types/calculator';
import {
  applyInfillOpeningTemplate,
  getTriangleHighSide,
  getTrianglePointSide,
  inferInfillOpeningTemplate,
  setTriangleHighSide,
  syncInfillMonoSlopeDraft,
} from './infillOpeningTemplates';

const rectangle: InfillLineItem['shape'] = {
  type: 'rect',
  widthM: '2.4',
  heightM: '1.8',
  bottomOffsetM: '0.4',
};

describe('infill opening templates', () => {
  it('infers existing rectangle, sloping-top and triangle geometry without persisted metadata', () => {
    expect(inferInfillOpeningTemplate(rectangle)).toBe('rectangle');
    expect(inferInfillOpeningTemplate({
      type: 'mono_slope', widthM: '2', heightLowM: '1', heightHighM: '2', slopeMode: 'heights',
    })).toBe('sloping_top');
    expect(inferInfillOpeningTemplate({
      type: 'mono_slope', widthM: '2', heightLowM: '0', heightHighM: '2', slopeMode: 'heights',
    })).toBe('triangle');
    expect(inferInfillOpeningTemplate({
      type: 'mono_slope', widthM: '2', heightLowM: '-1', heightHighM: '2', slopeMode: 'heights',
    })).toBe('sloping_top');
  });

  it('preserves width, height and installation position when starting each visual template', () => {
    expect(applyInfillOpeningTemplate(rectangle, 'sloping_top')).toEqual({
      type: 'mono_slope',
      widthM: '2.4',
      heightLowM: '1.8',
      heightHighM: '1.8',
      bottomOffsetM: '0.4',
      slopeMode: 'heights',
      slopeDeg: '',
      slopeAnchor: 'left',
    });
    expect(applyInfillOpeningTemplate(rectangle, 'triangle')).toMatchObject({
      type: 'mono_slope',
      widthM: '2.4',
      heightLowM: '0',
      heightHighM: '1.8',
      bottomOffsetM: '0.4',
    });
  });

  it('keeps Triangle selected while its peak height is still an empty draft', () => {
    const emptyRectangle: InfillLineItem['shape'] = {
      type: 'rect', widthM: '', heightM: '', bottomOffsetM: '0',
    };
    const triangle = applyInfillOpeningTemplate(emptyRectangle, 'triangle');

    expect(triangle).toMatchObject({ heightLowM: '0', heightHighM: '' });
    expect(inferInfillOpeningTemplate(triangle)).toBe('triangle');
    expect(getTriangleHighSide(triangle)).toBe('right');
    if (triangle.type !== 'mono_slope') throw new Error('Triangle template must use mono-slope storage.');
    expect(syncInfillMonoSlopeDraft({ ...triangle, widthM: '2' })).toMatchObject({
      widthM: '2', heightLowM: '0', heightHighM: '',
    });
    expect(applyInfillOpeningTemplate(triangle, 'sloping_top')).toMatchObject({
      heightLowM: '0', heightHighM: '0',
    });
  });

  it('uses the taller sloping side as the triangle peak and the greatest height for rectangles', () => {
    const slope: InfillLineItem['shape'] = {
      type: 'mono_slope',
      widthM: '2',
      heightLowM: '2.2',
      heightHighM: '1.1',
      bottomOffsetM: '0.3',
      slopeMode: 'heights',
    };

    expect(applyInfillOpeningTemplate(slope, 'triangle')).toMatchObject({ heightLowM: '2.2', heightHighM: '0' });
    expect(applyInfillOpeningTemplate(slope, 'rectangle')).toEqual({
      type: 'rect', widthM: '2', heightM: '2.2', bottomOffsetM: '0.3',
    });
  });

  it('raises the point to the peak when changing a triangle to a sloping top', () => {
    const triangle: InfillLineItem['shape'] = {
      type: 'mono_slope', widthM: '2', heightLowM: '0', heightHighM: '1.5', slopeMode: 'heights',
    };

    expect(applyInfillOpeningTemplate(triangle, 'sloping_top')).toMatchObject({
      heightLowM: '1.5', heightHighM: '1.5', slopeMode: 'heights',
    });
  });

  it('swaps the triangle point and peak without changing its peak height', () => {
    const triangle = applyInfillOpeningTemplate(rectangle, 'triangle');
    const highLeft = setTriangleHighSide(triangle, 'left');

    expect(getTriangleHighSide(triangle)).toBe('right');
    expect(getTrianglePointSide(triangle)).toBe('left');
    expect(highLeft).toMatchObject({ heightLowM: '1.8', heightHighM: '0' });
    expect(getTriangleHighSide(highLeft)).toBe('left');
    expect(getTrianglePointSide(highLeft)).toBe('right');
  });
});
