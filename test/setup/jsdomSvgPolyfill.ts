/**
 * JSDOM polyfill for the SVG measurement APIs that PlanViewport's pointer
 * pipeline depends on.
 *
 * Why this exists: JSDOM doesn't implement `SVGSVGElement.getScreenCTM` or
 * `createSVGPoint`. Tests that mount `PlanCanvas` and dispatch a pointer
 * event hit `clientPointToPlanProjection -> clientPointToSvg ->
 * svg.getScreenCTM()` -- which throws `TypeError: svg.getScreenCTM is not a
 * function`, killing the test even though the surface under test is the
 * tool dispatcher / commit handlers (not the SVG-to-screen math).
 *
 * The polyfill installs an identity transform: client coords pass through
 * unchanged into SVG coords. This is a simplification, not a faithful SVG
 * implementation -- real browsers apply viewBox + element bounding box
 * transforms here. For unit/integration tests that drive synthetic pointer
 * events with client-space coords already in the desired SVG space, the
 * identity transform matches expectations.
 *
 * If a future test needs realistic CTM (zoom, viewBox scaling, etc.),
 * stub `getScreenCTM` per-test rather than expanding this polyfill.
 *
 * Active under JSDOM only. No-op when SVGSVGElement isn't available.
 */
type IdentityMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  inverse: () => IdentityMatrix;
};

function buildIdentityMatrix(): IdentityMatrix {
  const matrix: IdentityMatrix = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse: () => buildIdentityMatrix(),
  };
  return matrix;
}

type SyntheticSvgPoint = {
  x: number;
  y: number;
  matrixTransform: (matrix: IdentityMatrix) => SyntheticSvgPoint;
};

function buildSyntheticSvgPoint(): SyntheticSvgPoint {
  const point: SyntheticSvgPoint = {
    x: 0,
    y: 0,
    matrixTransform(matrix: IdentityMatrix) {
      // Identity matrix: x' = a*x + c*y + e = x; y' = b*x + d*y + f = y.
      // We still apply the formula so non-identity matrices (if a future
      // test stubs one) flow through correctly.
      return {
        ...buildSyntheticSvgPoint(),
        x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f,
      };
    },
  };
  return point;
}

if (typeof SVGSVGElement !== 'undefined') {
  if (typeof SVGSVGElement.prototype.getScreenCTM !== 'function') {
    Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
      value: function getScreenCTMPolyfill() {
        return buildIdentityMatrix();
      },
      writable: true,
      configurable: true,
    });
  }
  if (typeof SVGSVGElement.prototype.createSVGPoint !== 'function') {
    Object.defineProperty(SVGSVGElement.prototype, 'createSVGPoint', {
      value: function createSVGPointPolyfill() {
        return buildSyntheticSvgPoint();
      },
      writable: true,
      configurable: true,
    });
  }
}
