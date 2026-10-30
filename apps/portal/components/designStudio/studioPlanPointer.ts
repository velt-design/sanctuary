import { studioPlanPoint } from "./studioHousePlanFrame";

export type StudioPlanPointerMapping = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  units: number;
};

/** Copy the press-time transform. A transient header/layout resize must not
 * reinterpret a held screen coordinate as a different world coordinate. */
export function captureStudioPlanPointerMapping(
  svg: SVGSVGElement | null,
  units: number,
): StudioPlanPointerMapping | null {
  const inverse = svg?.getScreenCTM()?.inverse();
  if (
    !inverse ||
    ![
      inverse.a,
      inverse.b,
      inverse.c,
      inverse.d,
      inverse.e,
      inverse.f,
      units,
    ].every(Number.isFinite)
  )
    return null;
  const { a, b, c, d, e, f } = inverse;
  return { a, b, c, d, e, f, units };
}
export function studioPlanPointerPoint(
  mapping: StudioPlanPointerMapping,
  x: number,
  y: number,
) {
  return studioPlanPoint({
    x: mapping.a * x + mapping.c * y + mapping.e,
    y: mapping.b * x + mapping.d * y + mapping.f,
  });
}
