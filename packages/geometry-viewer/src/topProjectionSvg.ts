import type {
  GeometryTopProjectionFamily,
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from "@sp/geometry";

export type TopProjectionSvgPaletteEntry = {
  fill: string;
  stroke: string;
};

export type TopProjectionSvgOptions = {
  ariaLabel?: string;
  paddingMm?: number;
  strokeWidthMm?: number;
  palette?: Partial<Record<GeometryTopProjectionFamily, TopProjectionSvgPaletteEntry>>;
};

const DEFAULT_PALETTE: Record<GeometryTopProjectionFamily, TopProjectionSvgPaletteEntry> = {
  pergola: { fill: "#d8ddd3", stroke: "#4f5a4b" },
  house: { fill: "#ece8df", stroke: "#6c675e" },
  reference: { fill: "none", stroke: "#8a8a82" },
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function finiteNonNegative(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function formatNumber(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized.toFixed(3).replace(/\.?0+$/u, "");
}

function renderableShape(shape: GeometryTopProjectionShape): boolean {
  return (
    shape.polygon.length >= 3 &&
    shape.polygon.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  );
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareShapes(left: GeometryTopProjectionShape, right: GeometryTopProjectionShape): number {
  return (
    left.zOrder - right.zOrder ||
    compareText(left.id, right.id) ||
    compareText(left.sourceObjectId, right.sourceObjectId)
  );
}

export function serializeTopProjectionSvg(
  projection: GeometryTopProjectionViewModel,
  options: TopProjectionSvgOptions = {},
): string {
  const paddingMm = finiteNonNegative(options.paddingMm, 0);
  const strokeWidthMm = finiteNonNegative(options.strokeWidthMm, 12);
  const ariaLabel = options.ariaLabel?.trim() || "Top projection";
  const extents = projection.extents;

  if (!extents) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" role="img" aria-label="${escapeXml(ariaLabel)}"></svg>`;
  }

  const width = Math.max(extents.widthMm, 1) + paddingMm * 2;
  const height = Math.max(extents.heightMm, 1) + paddingMm * 2;
  const polygons = [...projection.shapes]
    .filter(renderableShape)
    .sort(compareShapes)
    .map((shape) => {
      const palette = options.palette?.[shape.family] ?? DEFAULT_PALETTE[shape.family];
      const points = shape.polygon
        .map((point) => {
          const x = projection.screenAxis.x === "world_x_left"
            ? extents.maxX - point.x + paddingMm
            : point.x - extents.minX + paddingMm;
          const y = point.y - extents.minY + paddingMm;
          return `${formatNumber(x)},${formatNumber(y)}`;
        })
        .join(" ");
      return `<polygon data-shape-id="${escapeXml(shape.id)}" data-family="${shape.family}" data-kind="${escapeXml(shape.kind)}" points="${points}" fill="${escapeXml(palette.fill)}" stroke="${escapeXml(palette.stroke)}" stroke-width="${formatNumber(strokeWidthMm)}" vector-effect="non-scaling-stroke" />`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" role="img" aria-label="${escapeXml(ariaLabel)}">${polygons}</svg>`;
}
