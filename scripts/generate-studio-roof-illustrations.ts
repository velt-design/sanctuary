import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  solvePergolaPreview,
  type PreviewRoofChoices,
} from "@sp/configurator/geometry";
import type {
  AssemblyMember3D,
  Point3,
  RepresentativeRoofFinish,
} from "@sp/geometry";

const input = {
  widthMm: 6000,
  projectionMm: 3000,
  level: "ground" as const,
  connection: "facade" as const,
};
const options = { supportDatumMm: 2400 };
const families = ["mono", "gable", "box"] as const;
const ceilings = [
  "thermopine-100",
  "thermopine-150",
  "cedar-100",
  "cedar-150",
] as const;
export const projectStudioIsometric = ({ x, y, z }: Point3) => ({
  x: (Math.sqrt(3) / 2) * (x - y),
  y: (x + y) / 2 - z,
});
function memberCorners(member: AssemblyMember3D) {
  return [member.centerline.start, member.centerline.end].flatMap((point) =>
    [-1, 1].flatMap((width) =>
      [-1, 1].map((depth) => ({
        x:
          point.x +
          ((member.localFrame.yAxis.x * member.profile.widthMm) / 2) * width +
          ((member.localFrame.zAxis.x * member.profile.depthMm) / 2) * depth,
        y:
          point.y +
          ((member.localFrame.yAxis.y * member.profile.widthMm) / 2) * width +
          ((member.localFrame.zAxis.y * member.profile.depthMm) / 2) * depth,
        z:
          point.z +
          ((member.localFrame.yAxis.z * member.profile.widthMm) / 2) * width +
          ((member.localFrame.zAxis.z * member.profile.depthMm) / 2) * depth,
      })),
    ),
  );
}
function silhouette(points: ReturnType<typeof projectStudioIsometric>[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y),
    cross = (a: (typeof sorted)[number], b: typeof a, c: typeof a) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (values: typeof sorted) => {
    const result: typeof sorted = [];
    for (const point of values) {
      while (
        result.length > 1 &&
        cross(result[result.length - 2], result[result.length - 1], point) <= 0
      )
        result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

function geometry(
  family: PreviewRoofChoices["family"],
  patch: Partial<PreviewRoofChoices> = {},
) {
  const solved = solvePergolaPreview(
    input,
    {
      family,
      orientation: "parallel",
      infills: false,
      attachmentIntent: "freestanding",
      ...patch,
    },
    options,
  ).geometry;
  if (!solved)
    throw Error(`Canonical ${family} illustration geometry is unavailable.`);
  return solved;
}

/** Equal orthographic axes and one shared frame. Actual pitches stay untouched. */
export function studioRoofFormIllustrations() {
  const examples = families.map((family) => ({
    family,
    geometry: geometry(family),
  }));
  const all = examples
    .flatMap((example) =>
      example.geometry.assembly.members.flatMap(memberCorners),
    )
    .map(projectStudioIsometric);
  const loX = Math.min(...all.map((p) => p.x)),
    hiX = Math.max(...all.map((p) => p.x)),
    loY = Math.min(...all.map((p) => p.y)),
    hiY = Math.max(...all.map((p) => p.y));
  const scale = Math.min(106 / (hiX - loX), 68 / (hiY - loY));
  const at = (p: { x: number; y: number }) =>
    `${(60 + (p.x - (loX + hiX) / 2) * scale).toFixed(3)},${(41 + (p.y - (loY + hiY) / 2) * scale).toFixed(3)}`;
  const point = (p: Point3) => at(projectStudioIsometric(p));
  return Object.fromEntries(
    examples.map(({ family, geometry }) => {
      const roofs = geometry.assembly.roofPlanes
        .map(
          (roof) =>
            `<polygon points="${roof.boundary.map(point).join(" ")}" fill="#e4e9e3" fill-opacity=".65" stroke="#82907f" stroke-width=".7"/>`,
        )
        .join("");
      const members = [...geometry.assembly.members].sort(
        (a, b) =>
          a.centerline.start.x +
          a.centerline.start.y -
          (b.centerline.start.x + b.centerline.start.y),
      );
      const lines = members
        .map(
          (member) =>
            `<polygon points="${silhouette(memberCorners(member).map(projectStudioIsometric)).map(at).join(" ")}" fill="#e0e5dc" stroke-width=".65"/>`,
        )
        .join("");
      return [
        `roof-${family}.svg`,
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 82" fill="none" stroke="#30382e" stroke-linecap="round" stroke-linejoin="round">${roofs}${lines}</svg>\n`,
      ];
    }),
  ) as Record<string, string>;
}

/** Same flat timber/acrylic swatch language; every region is canonical covering
 * data, including the eligible gable house band. No new skylight proportions. */
export function studioMixedRoofSwatch(
  family: PreviewRoofChoices["family"],
  orientation: PreviewRoofChoices["orientation"],
  layout: RepresentativeRoofFinish["layout"],
  ceiling: NonNullable<RepresentativeRoofFinish["ceiling"]>,
) {
  const finish: RepresentativeRoofFinish = {
    material: "combination",
    layout,
    profile: "corrugated",
    trayWidth: 400,
    acrylicBays: 2,
    ceiling,
  };
  const covering = geometry(family, { orientation, finish }).covering;
  if (!covering?.regions.length)
    throw Error("Canonical mixed illustration regions are unavailable.");
  const points = covering.regions.flatMap((region) => region.boundary),
    loX = Math.min(...points.map((p) => p.x)),
    hiX = Math.max(...points.map((p) => p.x)),
    loY = Math.min(...points.map((p) => p.y)),
    hiY = Math.max(...points.map((p) => p.y));
  const point = (p: Point3) =>
    `${(((p.x - loX) / (hiX - loX)) * 120).toFixed(4)},${(((hiY - p.y) / (hiY - loY)) * 64).toFixed(4)}`;
  const timber = ceiling.startsWith("cedar") ? "#95633f" : "#b1885e",
    board = ceiling.endsWith("100") ? 6 : 9;
  const grain = covering.meshes.find(
    (mesh) => mesh.kind === "cedar",
  )?.grainAlong;
  if (!grain) throw Error("Canonical mixed ceiling direction is unavailable.");
  const rotation = (Math.atan2(-grain.y, grain.x) * 180) / Math.PI - 90;
  const regions = covering.regions
    .map(
      (region) =>
        `<polygon data-material="${region.material}" points="${region.boundary.map(point).join(" ")}" fill="url(#${region.material === "solid" ? "timber" : "acrylic"})"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 64" preserveAspectRatio="none"><defs><pattern id="timber" width="${board}" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(${rotation})"><rect width="${board}" height="64" fill="${timber}"/><path d="M.5 0V64" stroke="#8c6744" stroke-width="1"/></pattern><pattern id="acrylic" width="8" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(${rotation})"><rect width="8" height="64" fill="#d8dfdf"/><path d="M.5 0V64" stroke="#b6c4c7" stroke-width="1"/></pattern></defs>${regions}</svg>\n`;
}

export function studioRoofIllustrations() {
  const result = studioRoofFormIllustrations();
  for (const family of families)
    for (const orientation of family === "gable"
      ? (["parallel", "away"] as const)
      : (["parallel"] as const))
      for (const layout of family === "gable" && orientation === "away"
        ? (["central", "house"] as const)
        : (["central"] as const))
        for (const ceiling of ceilings)
          result[`mixed-${family}-${orientation}-${layout}-${ceiling}.svg`] =
            studioMixedRoofSwatch(family, orientation, layout, ceiling);
  return result;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  const output = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../apps/portal/public/studio",
  );
  fs.mkdirSync(output, { recursive: true });
  for (const [name, svg] of Object.entries(studioRoofIllustrations()))
    fs.writeFileSync(path.join(output, name), svg);
  console.log("Regenerated23 canonical Studio roof illustrations.");
}
