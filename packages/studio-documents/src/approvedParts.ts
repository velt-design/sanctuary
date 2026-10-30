import type { Point3 } from "@sp/geometry";
import type {
  StudioDocumentProduct,
  StudioClientDocumentSource,
} from "./contract";
import { studioDocumentTriangles } from "./mesh";
import { approvedRoofSurfaces } from "./approvedRoofSurfaces";
export type Part = {
  id: string;
  kind: string;
  triangles: Point3[][];
  glass: boolean;
};
const fan = (points: Point3[]) =>
  points.slice(1, -1).map((p, i) => [points[0], p, points[i + 2]]);
export function actualParts(
  product: StudioDocumentProduct,
  {
    roof = true,
    accessories = true,
    frame = true,
    physicalDetails = false,
    joins = [],
  }: {
    roof?: boolean;
    accessories?: boolean;
    frame?: boolean;
    physicalDetails?: boolean;
    joins?: StudioClientDocumentSource["joins"];
  } = {},
) {
  const parts: Part[] = [];
  const blank = {
    ...product,
    accessories: [],
    covering: undefined,
    assembly: {
      ...product.assembly,
      roofCladdingPanels: [],
      roofFlashings: [],
    },
  };
  for (const object of product.viewerScene.layers
    .flatMap((l) => l.objects)
    .filter((o) => o.type === "member_prism")) {
    const member = product.assembly.members.find((m) => m.id === object.id);
    if (!member) throw Error(`Unknown member ${object.id}`);
    if (!frame && member.role !== "post") continue;
    let body = object;
    const md = object.metadata ?? member.metadata ?? {};
    if (
      physicalDetails &&
      member.role === "gutter" &&
      md.endCapWidthMm &&
      md.endCapDepthMm
    ) {
      const a = object.centerline.start,
        b = object.centerline.end,
        length = object.lengthMm,
        u = {
          x: (b.x - a.x) / length,
          y: (b.y - a.y) / length,
          z: (b.z - a.z) / length,
        },
        v = object.localFrame.yAxis,
        w = object.localFrame.zAxis;
      const point = (x: number, y: number, z: number) => ({
        x: a.x + u.x * x + v.x * y + w.x * z,
        y: a.y + u.y * x + v.y * y + w.y * z,
        z: a.z + u.z * x + v.z * y + w.z * z,
      });
      for (const [end, x0, x1] of [
        ["start", 0, Number(md.endCapStartMm)],
        ["end", length - Number(md.endCapEndMm), length],
      ] as const) {
        const hw = Number(md.endCapWidthMm) / 2,
          hd = Number(md.endCapDepthMm) / 2,
          corners = [
            [x0, -hw, -hd],
            [x1, -hw, -hd],
            [x1, hw, -hd],
            [x0, hw, -hd],
            [x0, -hw, hd],
            [x1, -hw, hd],
            [x1, hw, hd],
            [x0, hw, hd],
          ].map((v) => point(v[0], v[1], v[2]));
        const triangles = [];
        for (const face of [
          [0, 3, 2, 1],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [1, 2, 6, 5],
          [2, 3, 7, 6],
          [3, 0, 4, 7],
        ])
          triangles.push(...fan(face.map((i) => corners[i])));
        parts.push({
          id: `${member.id}:cap:${end}`,
          kind: "gutter",
          triangles,
          glass: false,
        });
      }
      const insetStart = Number(md.bodyInsetStartMm ?? 0),
        insetEnd = Number(md.bodyInsetEndMm ?? 0);
      body = {
        ...object,
        lengthMm: length - insetStart - insetEnd,
        centerline: {
          start: point(insetStart, 0, 0),
          end: point(length - insetEnd, 0, 0),
        },
      };
    }
    const only = {
      ...blank,
      viewerScene: {
        ...product.viewerScene,
        layers: [{ ...product.viewerScene.layers[0], objects: [body] }],
      },
    };
    parts.push({
      id: member.id,
      kind: member.role,
      triangles: studioDocumentTriangles(only).map((t) => t.points),
      glass: false,
    });
  }
  if (roof) {
    for (const panel of product.assembly.roofCladdingPanels)
      parts.push({
        id: panel.id,
        kind: "glass",
        triangles: fan(panel.boundary),
        glass: true,
      });
    if (
      approvedRoofSurfaces(product).fullAcrylicRoof &&
      !product.assembly.roofCladdingPanels.length
    )
      for (const plane of product.assembly.roofPlanes)
        parts.push({
          id: plane.id,
          kind: "glass",
          triangles: fan(plane.boundary),
          glass: true,
        });
    for (const mesh of product.covering?.meshes ?? [])
      parts.push({
        id: mesh.id,
        kind: mesh.kind,
        triangles: Array.from({ length: mesh.indices.length / 3 }, (_, i) =>
          mesh.indices.slice(i * 3, i * 3 + 3).map((n) => ({
            x: mesh.positions[n * 3],
            y: mesh.positions[n * 3 + 1],
            z: mesh.positions[n * 3 + 2],
          })),
        ),
        glass: false,
      });
    for (const flashing of product.assembly.roofFlashings ?? []) {
      if (physicalDetails) {
        const only = {
          ...blank,
          assembly: { ...blank.assembly, roofFlashings: [flashing] },
          viewerScene: { ...product.viewerScene, layers: [] },
        };
        parts.push({
          id: flashing.id,
          kind: "flashing",
          triangles: studioDocumentTriangles(only).map((t) => t.points),
          glass: false,
        });
      } else
        for (const [i, w] of flashing.wings.entries())
          parts.push({
            id: `${flashing.id}:${i}`,
            kind: "flashing",
            triangles: fan(w.boundary),
            glass: false,
          });
    }
  }
  if (accessories)
    for (const mesh of product.accessories.filter((m) => m.kind !== "light"))
      parts.push({
        id: mesh.id,
        kind: mesh.kind,
        triangles: Array.from({ length: mesh.indices.length / 3 }, (_, i) =>
          mesh.indices.slice(i * 3, i * 3 + 3).map((n) => ({
            x: mesh.positions[n * 3],
            y: mesh.positions[n * 3 + 1],
            z: mesh.positions[n * 3 + 2],
          })),
        ),
        glass: mesh.kind === "acrylic",
      });
  if (roof && joins.length) {
    const isolated = {
      ...blank,
      viewerScene: { ...blank.viewerScene, layers: [] },
    };
    const triangles = studioDocumentTriangles(isolated, joins);
    if (triangles.length)
      parts.push({
        id: "selected-pergola-joins",
        kind: "flashing",
        glass: false,
        triangles: triangles.map((t) => t.points),
      });
  }
  return parts;
}
