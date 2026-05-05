import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import { buildTopProjectionPlanCoordinateAdapter } from '@/lib/drawings/views/plan/planCoordinateAdapter';
import { resolvePlanLayout } from '../planLayout';
import type { PlanDimension } from '../planDimension';
import { PlanDimensionLayer } from './PlanDimensionLayer';

function makeProjection(): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: { x: 'world_x_right', y: 'world_y_down' },
    extents: {
      minX: 0,
      minY: 0,
      maxX: 5000,
      maxY: 3000,
      widthMm: 5000,
      heightMm: 3000,
    },
    shapes: [],
  };
}

function buildAdapter() {
  const projection = makeProjection();
  const layout = resolvePlanLayout(projection);
  return buildTopProjectionPlanCoordinateAdapter({
    projection,
    baseX: layout.baseX,
    baseY: layout.baseY,
    scale: layout.scale,
  });
}

function svgWrap(node: ReturnType<typeof PlanDimensionLayer>): string {
  return renderToStaticMarkup(<svg viewBox="0 0 1000 1000">{node}</svg>);
}

describe('PlanDimensionLayer', () => {
  it('renders nothing for an empty dimension list', () => {
    const adapter = buildAdapter();
    const markup = svgWrap(<PlanDimensionLayer dimensions={[]} coordinateAdapter={adapter} />);
    expect(markup).toContain('data-plan-layer="dimensions"');
    expect(markup).not.toContain('data-plan-dimension-id');
  });

  it('renders a dim group with extension lines, dim line, two arrows, and a label per dimension', () => {
    const adapter = buildAdapter();
    const dimension: PlanDimension = {
      id: 'wall-1',
      start: { x: 0, y: 0 },
      end: { x: 2400, y: 0 },
    };
    const markup = svgWrap(
      <PlanDimensionLayer dimensions={[dimension]} coordinateAdapter={adapter} />,
    );
    expect(markup).toContain('data-plan-dimension-id="wall-1"');
    expect(markup).toContain('data-plan-dimension-length-mm="2400"');
    expect(markup).toContain('data-plan-dimension-part="extension-start"');
    expect(markup).toContain('data-plan-dimension-part="extension-end"');
    expect(markup).toContain('data-plan-dimension-part="dim-line"');
    expect(markup).toContain('data-plan-dimension-part="arrow-start"');
    expect(markup).toContain('data-plan-dimension-part="arrow-end"');
    expect(markup).toContain('data-plan-dimension-part="label"');
    expect(markup).toContain('>2400<');
  });

  it('skips dimensions with zero length', () => {
    const adapter = buildAdapter();
    const markup = svgWrap(
      <PlanDimensionLayer
        dimensions={[
          { id: 'zero', start: { x: 100, y: 100 }, end: { x: 100, y: 100 } },
          { id: 'real', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } },
        ]}
        coordinateAdapter={adapter}
      />,
    );
    expect(markup).not.toContain('data-plan-dimension-id="zero"');
    expect(markup).toContain('data-plan-dimension-id="real"');
  });

  it('honours an explicit label override', () => {
    const adapter = buildAdapter();
    const markup = svgWrap(
      <PlanDimensionLayer
        dimensions={[{ id: 'd', start: { x: 0, y: 0 }, end: { x: 1500, y: 0 }, label: '1.5m' }]}
        coordinateAdapter={adapter}
      />,
    );
    expect(markup).toContain('>1.5m<');
    expect(markup).not.toMatch(/>1500</);
  });
});
