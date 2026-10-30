"use client";
import { useMemo, useEffect } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
  DoubleSide,
} from "three";
import { Line } from "@react-three/drei";
import type {
  Point3,
  RenderMesh3D,
  RoofPlane3D,
  RoofFlashing3D,
} from "@sp/geometry";
import { buildPolygonSlabGeometry } from "@sp/geometry-viewer/three";
import {
  studioHouseMaterial,
  studioHouseSurfaceUV,
} from "./studioHouseMaterials";
import { houseWorld } from "@/lib/designStudio/studioHouseGeometry";
import { boxedHouseSoffits } from "@/lib/designStudio/studioHouseWebsiteContact";
import type { StudioHouseGeometry } from "@/lib/designStudio/studioHouseGeometry";
/** Studio presentation consumes solved polygons; no workbench scene dispatcher/materials. */
function Surface({ points, color }: { points: Point3[]; color: string }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry(),
      a = points[0],
      b = points[1],
      c = points[2];
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z },
      v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z },
      normal = {
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x,
      };
    const axis =
      Math.abs(normal.z) >= Math.abs(normal.x) &&
      Math.abs(normal.z) >= Math.abs(normal.y)
        ? "z"
        : Math.abs(normal.x) > Math.abs(normal.y)
          ? "x"
          : "y";
    const projected = points.map(
      (p) => new Vector2(axis === "x" ? p.y : p.x, axis === "z" ? p.y : p.z),
    );
    const triangles = ShapeUtils.triangulateShape(projected, []);
    g.setAttribute(
      "position",
      new Float32BufferAttribute(
        triangles.flatMap((t) =>
          t.flatMap((i) => [points[i].x, points[i].y, points[i].z]),
        ),
        3,
      ),
    );
    g.computeVertexNormals();
    return g;
  }, [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} side={DoubleSide} />
    </mesh>
  );
}
function Solid({
  mesh,
  color,
  house,
}: {
  mesh: RenderMesh3D;
  color: string;
  house: StudioHouseGeometry["house"];
}) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute(
        mesh.faces.flatMap((face) =>
          face.flatMap((i) => {
            const p = houseWorld(house, mesh.vertices[i]);
            return [p.x, p.y, p.z];
          }),
        ),
        3,
      ),
    );
    g.computeVertexNormals();
    return g;
  }, [mesh, house]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.82} side={DoubleSide} />
    </mesh>
  );
}
function FinishedSolid({
  mesh,
  kind,
  house,
  roof,
}: {
  mesh: RenderMesh3D;
  kind: "roof" | "wall";
  house: StudioHouseGeometry["house"];
  roof?: RoofPlane3D;
}) {
  const appearance = house.source.appearance;
  const finish = useMemo(
    () => studioHouseMaterial(kind, appearance),
    [
      kind,
      appearance?.wallMaterial,
      appearance?.roofProfile,
      appearance?.roofTrayWidth,
      appearance?.roofColour,
    ],
  );
  const geometry = useMemo(() => {
    const points = mesh.faces.flatMap((face) =>
        face.map((i) => mesh.vertices[i]),
      ),
      world = points.map((point) => houseWorld(house, point)),
      g = new BufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute(
        world.flatMap((point) => [point.x, point.y, point.z]),
        3,
      ),
    );
    g.setAttribute(
      "uv",
      new Float32BufferAttribute(
        studioHouseSurfaceUV(points, finish.repeat, roof),
        2,
      ),
    );
    g.computeVertexNormals();
    return g;
  }, [mesh, house, roof, finish]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => finish.dispose(), [finish]);
  return (
    <mesh
      geometry={geometry}
      material={finish.material}
      castShadow
      receiveShadow
    />
  );
}
function RoofFlashing({
  flashing,
  house,
  color,
}: {
  flashing: RoofFlashing3D;
  house: StudioHouseGeometry["house"];
  color: string;
}) {
  const wings = useMemo(
    () =>
      flashing.wings.map((wing) => {
        const geometry = buildPolygonSlabGeometry(
          wing.boundary,
          wing.plane,
          flashing.thicknessMm,
        );
        const positions = geometry.getAttribute("position");
        for (let i = 0; i < positions.count; i++) {
          const world = houseWorld(house, {
            x: positions.getX(i),
            y: positions.getY(i),
            z: positions.getZ(i),
          });
          positions.setXYZ(i, world.x, world.y, world.z);
        }
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        return { id: wing.id, geometry };
      }),
    [flashing, house],
  );
  useEffect(
    () => () => wings.forEach((wing) => wing.geometry.dispose()),
    [wings],
  );
  return (
    <group name={flashing.id}>
      {wings.map((wing) => (
        <mesh key={wing.id} geometry={wing.geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={color}
            metalness={0.25}
            roughness={0.48}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
export default function StudioHouseNode({
  geometry,
  selected,
  onSelect,
  refined = false,
  cad = false,
}: {
  geometry: StudioHouseGeometry;
  selected: boolean;
  onSelect: () => void;
  refined?: boolean;
  cad?: boolean;
}) {
  const centre = geometry.footprint.reduce(
    (a, p) => ({
      x: a.x + p.x / geometry.footprint.length,
      y: a.y + p.y / geometry.footprint.length,
    }),
    { x: 0, y: 0 },
  );
  const solids = geometry.model.solids;
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {refined && solids ? (
        <>
          <Surface
            points={geometry.footprint.map((p) => ({
              x: centre.x + (p.x - centre.x) * 1.045,
              y: centre.y + (p.y - centre.y) * 1.075,
              z: 1,
            }))}
            color="#c5bfb2"
          />
          {solids.surfaceSolids
            .filter((s) => s.kind !== "soffit" && s.renderMesh)
            .map((s) =>
              s.kind === "roof" || s.kind === "wall" ? (
                <FinishedSolid
                  key={s.id}
                  mesh={s.renderMesh!}
                  kind={s.kind}
                  house={geometry.house}
                  roof={
                    s.kind === "roof"
                      ? geometry.model.roofPlanes.find(
                          (roof) => roof.id === s.metadata?.sourceId,
                        )
                      : undefined
                  }
                />
              ) : (
                <Solid
                  key={s.id}
                  mesh={s.renderMesh!}
                  house={geometry.house}
                  color={cad ? "#cbd1ca" : "#dddcd2"}
                />
              ),
            )}
          {solids.linearSolids
            .filter((s) => s.renderMesh)
            .map((s) => (
              <Solid
                key={s.id}
                mesh={s.renderMesh!}
                house={geometry.house}
                color="#adb7aa"
              />
            ))}
          {boxedHouseSoffits(geometry).map((s, i) => (
            <Surface key={`${s.side}:${i}`} points={s.world} color="#d8d7cc" />
          ))}
        </>
      ) : (
        <>
          {geometry.walls.map((p, i) => (
            <Surface key={`wall${i}`} points={p} color="#ddd8cc" />
          ))}
          {geometry.roof.map((p, i) => (
            <Surface key={`roof${i}`} points={p} color="#7e837b" />
          ))}
          {geometry.eaves.map((p, i) => (
            <Surface key={`eave${i}`} points={p} color="#b4b7ad" />
          ))}
          {geometry.soffits.map((p, i) => (
            <Surface key={`soffit${i}`} points={p} color="#d2cfc5" />
          ))}
        </>
      )}
      <group name="house-roof-flashings">
        {(geometry.model.roofFlashings ?? []).map((flashing) => (
          <RoofFlashing
            key={flashing.id}
            flashing={flashing}
            house={geometry.house}
            color={
              geometry.house.source.appearance?.roofColour ??
              (refined ? "#343b39" : "#7e837b")
            }
          />
        ))}
      </group>
      {selected && (
        <Line
          points={[...geometry.footprint, geometry.footprint[0]].map((p) => [
            p.x,
            p.y,
            10,
          ])}
          color="#826344"
          lineWidth={2}
        />
      )}
    </group>
  );
}
