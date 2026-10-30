import {
  finiteNormalAlignments,
  dot,
  type Point,
  type Segment,
  type FiniteWitness,
} from "./finitePlacement";
export type AlignmentLine = Segment & {
  id: string;
  label: string;
  allowVertex?: boolean;
  departureKey?: string;
};
export type AlignmentGuide = {
  key: string;
  axis: "x" | "y" | null;
  witness: FiniteWitness;
  moving: Segment;
  target: AlignmentLine;
  normal: Point;
  label: string;
  correction: number;
  score: number;
  /** Relative footprint coordinates preserve the SAME physical witness. */
  shape: Point[];
};
const shape = (points: Point[]) =>
  points.map((p) => ({ x: p.x - points[0].x, y: p.y - points[0].y }));
export function alignmentChoices(
  points: Point[],
  lines: AlignmentLine[],
  units: number,
  held = "",
): AlignmentGuide[] {
  return lines
    .flatMap((line) =>
      finiteNormalAlignments(
        points,
        line,
        18 * units,
        !!line.allowVertex,
      ).flatMap((hit) => {
        const key = `${line.id}:${hit.witness.kind}:${hit.witness.index}`,
          retained = held.split("|").includes(key) || held === line.id;
        if (hit.distance > (retained ? 18 : 14) * units) return [];
        return [
          {
            ...hit,
            key,
            axis:
              Math.abs(hit.normal.x) > 0.999
                ? ("x" as const)
                : Math.abs(hit.normal.y) > 0.999
                  ? ("y" as const)
                  : null,
            target: line,
            label: line.label,
            score: hit.distance - (retained ? 3 * units : 0),
            shape: shape(points),
          },
        ];
      }),
    )
    .sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));
}
export function validAlignmentGuide(
  points: Point[],
  guide: AlignmentGuide,
  units: number,
) {
  const current = shape(points);
  if (
    current.length !== guide.shape.length ||
    current.some(
      (p, i) =>
        Math.hypot(p.x - guide.shape[i].x, p.y - guide.shape[i].y) > 1e-6,
    )
  )
    return false;
  return finiteNormalAlignments(
    points,
    guide.target,
    18 * units,
    !!guide.target.allowVertex,
  ).some(
    (hit) =>
      hit.witness.kind === guide.witness.kind &&
      hit.witness.index === guide.witness.index &&
      Math.abs(hit.correction) < 0.001,
  );
}
function correction(guides: AlignmentGuide[], units: number) {
  const [a, b] = guides;
  if (!a) return { x: 0, y: 0 };
  if (!b) return { x: a.normal.x * a.correction, y: a.normal.y * a.correction };
  const determinant = a.normal.x * b.normal.y - a.normal.y * b.normal.x;
  if (Math.abs(determinant) < 1e-3) return null;
  const x =
      (a.correction * b.normal.y - a.normal.y * b.correction) / determinant,
    y = (a.normal.x * b.correction - a.correction * b.normal.x) / determinant;
  // Composition cannot create a larger jump than the existing orthogonal
  // two-guide held region. Ill-conditioned competition keeps one witness.
  return Math.hypot(x, y) <= Math.SQRT2 * 18 * units + 1e-6 ? { x, y } : null;
}
export function composeFiniteAlignment(
  points: Point[],
  choices: AlignmentGuide[],
  units: number,
) {
  const first = choices[0];
  let guides = first ? [first] : [];
  const second =
    first &&
    choices.find(
      (c) =>
        c !== first &&
        Math.abs(dot(c.normal, first.normal)) < 0.999 &&
        correction([first, c], units),
    );
  if (second) guides.push(second);
  for (let attempt = 0; attempt < 3; attempt++) {
    const delta = correction(guides, units)!;
    const moved = points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y }));
    const invalid = guides.filter((g) => !validAlignmentGuide(moved, g, units));
    if (!invalid.length)
      return { points: moved, dx: delta.x, dy: delta.y, guides };
    // The second constraint cannot displace the stronger finite witness.
    // Drop it and retry the primary rather than retaining its invalidation.
    guides = guides.slice(0, -1);
  }
  return { points, dx: 0, dy: 0, guides: [] as AlignmentGuide[] };
}
export function alignmentDescription(guide: AlignmentGuide) {
  return `${guide.witness.kind === "vertex" ? "Corner aligned" : guide.axis ? guide.axis.toUpperCase() + " aligned" : "Edge aligned"} with ${guide.label}`;
}
