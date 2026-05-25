import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type {
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import PlanViewport from '../PlanViewport';

/*
 * PR-W2 (2026-05-23) — CAD-style canvas chrome guards.
 *
 * The Plan canvas is intentionally minimal: the only in-canvas chrome is the
 * `[role="toolbar"]` cluster at bottom-left (currently a single Fit-view
 * button; zoom %, +/-, Pan, Measure controls will appear here in later PRs).
 *
 * These guards prevent regressions from the two chrome anti-patterns called
 * out in the CAD-style UI handoff:
 *   1. A floating dark vertical tool palette inside the canvas.
 *   2. A bottom-right canvas caption (e.g. "Viewport shows selected pergola only").
 *
 * Neither exists today. The guards keep it that way.
 */

const IDENTITY_TRANSFORM: DrawingWorkbenchViewportTransform = { zoom: 1, panX: 0, panY: 0 };

function makeShape(overrides: Partial<GeometryTopProjectionShape>): GeometryTopProjectionShape {
  return {
    id: 'shape-1',
    sourceObjectId: 'shape-1',
    sourceId: null,
    sourceType: 'house_surface_solid',
    family: 'house',
    kind: 'footprint',
    polygon: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ],
    zOrder: 0,
    zMin: 0,
    zMax: 0,
    ...overrides,
  };
}

function makeProjection(shapes: GeometryTopProjectionShape[]): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: { x: 'world_x_right', y: 'world_y_down' },
    extents: { minX: 0, minY: 0, maxX: 5000, maxY: 3000, widthMm: 5000, heightMm: 3000 },
    shapes,
  };
}

function makeArtifact(): WorkbenchSolvedGeometryArtifact {
  return { topProjection: makeProjection([makeShape({})]) } as unknown as WorkbenchSolvedGeometryArtifact;
}

function renderCanvas(): string {
  return renderToStaticMarkup(
    <PlanViewport
      artifact={makeArtifact()}
      viewportTransform={IDENTITY_TRANSFORM}
      onViewportTransformChange={() => undefined}
    />,
  );
}

describe('PlanCanvas chrome guards (PR-W2)', () => {
  it('exposes exactly one canvas-level toolbar (the bottom-left nav cluster)', () => {
    const markup = renderCanvas();
    const toolbarMatches = markup.match(/role="toolbar"/g) ?? [];
    expect(toolbarMatches).toHaveLength(1);
    expect(markup).toContain('aria-label="Plan canvas controls"');
  });

  it('does not render a floating vertical tool palette inside the canvas', () => {
    const markup = renderCanvas();
    // The handoff anti-pattern is a dark vertical palette; flag any tool-
    // palette-style ARIA labels or class names so a future reintroduction
    // trips this guard.
    expect(markup).not.toMatch(/tool[\s_-]?palette/i);
    expect(markup).not.toMatch(/aria-label="[^"]*[Tt]ool [Pp]alette[^"]*"/);
  });

  it('does not render a bottom-right canvas caption', () => {
    const markup = renderCanvas();
    expect(markup).not.toContain('Viewport shows');
    expect(markup).not.toContain('selected pergola only');
    expect(markup).not.toMatch(/CAD[-\s]style hierarchy/i);
  });

  it('keeps the Fit-view nav button accessible (still rendered as a button)', () => {
    const markup = renderCanvas();
    expect(markup).toContain('data-plan-canvas-action="fit-view"');
    expect(markup).toContain('Fit view');
  });
});
