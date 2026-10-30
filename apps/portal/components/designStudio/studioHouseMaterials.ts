import {
  DataTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
} from "three";
import {
  representativeRoofProfile,
  roofCoordinates,
  type Point3,
  type RoofPlane3D,
} from "@sp/geometry";
import type { HouseFormAppearance } from "@/lib/drawings/state/objectFirstWorkbenchModel";

/** Display materials only. These textures never displace the canonical surface,
 * alter contact/quantities, or describe a supplier product. UVs use local mm so
 * moving/rotating a house does not move the finish across its surfaces. */
export function studioHouseMaterial(
  kind: "roof" | "wall",
  appearance?: HouseFormAppearance,
) {
  const roof = kind === "roof",
    wall = appearance?.wallMaterial ?? "plaster";
  const section = representativeRoofProfile(
    appearance?.roofProfile ?? "corrugated",
    appearance?.roofTrayWidth ?? 400,
  );
  const width = 256,
    height = roof ? 4 : 128,
    textured = roof || wall !== "plaster";
  const pixels = new Uint8Array(textured ? width * height * 4 : 0);
  if (textured)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let level = 1;
        if (roof) {
          const across = (x / width) * section.pitch;
          const next = section.points.findIndex(
            (point) => point.across >= across,
          );
          const a = section.points[Math.max(0, next - 1)],
            b = section.points[Math.max(0, next)];
          level =
            (b.across === a.across
              ? a.height
              : a.height +
                ((b.height - a.height) * (across - a.across)) /
                  (b.across - a.across)) / section.height;
        } else if (wall === "weatherboard") {
          level = y < 5 ? 0.1 : 0.9 - (0.25 * y) / height;
        } else if (wall === "brick") {
          const course = y < height / 2 ? 0 : 1,
            joint = (x + (course * width) / 2) % width;
          level = y % (height / 2) < 5 || joint < 5 ? 0.1 : 0.9;
        }
        const value = Math.round(level * 255),
          offset = (y * width + x) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
        pixels[offset + 3] = 255;
      }
  const texture = textured
    ? new DataTexture(pixels, width, height, RGBAFormat)
    : null;
  if (texture) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }
  const material = new MeshStandardMaterial({
    color: roof
      ? (appearance?.roofColour ?? "#343b39")
      : wall === "brick"
        ? "#b3a18d"
        : wall === "weatherboard"
          ? "#e2e4dc"
          : "#e4e7e0",
    roughness: roof ? 0.65 : 0.88,
    metalness: roof ? 0.2 : 0,
    side: DoubleSide,
    bumpMap: texture,
    bumpScale: roof ? section.height : wall === "brick" ? 4 : 7,
  });
  return {
    material,
    texture,
    repeat: roof
      ? { x: section.pitch, y: 1000 }
      : wall === "brick"
        ? { x: 480, y: 160 }
        : { x: 1000, y: 180 },
    dispose() {
      texture?.dispose();
      material.dispose();
    },
  };
}

export function studioHouseSurfaceUV(
  points: readonly Point3[],
  repeat: { x: number; y: number },
  roof?: RoofPlane3D,
) {
  // The existing finish frame owns roof orientation. A truly flat plane with no
  // fall has no material direction; its local XY is the presentation basis.
  const frame =
    roof && Math.hypot(roof.fallVector.x, roof.fallVector.y) > 0
      ? roofCoordinates(roof)
      : null;
  const normal =
    points.length > 2
      ? {
          x:
            (points[1].y - points[0].y) * (points[2].z - points[0].z) -
            (points[1].z - points[0].z) * (points[2].y - points[0].y),
          y:
            (points[1].z - points[0].z) * (points[2].x - points[0].x) -
            (points[1].x - points[0].x) * (points[2].z - points[0].z),
        }
      : { x: 0, y: 0 };
  return points.flatMap((point) =>
    frame
      ? [
          (point.x * frame.u.x + point.y * frame.u.y + point.z * frame.u.z) /
            repeat.x,
          (point.x * frame.v.x + point.y * frame.v.y + point.z * frame.v.z) /
            repeat.y,
        ]
      : roof
        ? [point.x / repeat.x, point.y / repeat.y]
        : [
            (Math.abs(normal.x) > Math.abs(normal.y) ? point.y : point.x) /
              repeat.x,
            point.z / repeat.y,
          ],
  );
}
