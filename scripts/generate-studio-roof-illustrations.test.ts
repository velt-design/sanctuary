import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import {
  projectStudioIsometric,
  studioRoofIllustrations,
  studioMixedRoofSwatch,
} from "./generate-studio-roof-illustrations";

it("projects all three orthogonal unit axes at equal scale without changing pitch", () => {
  const origin = projectStudioIsometric({ x: 0, y: 0, z: 0 });
  const axes = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ].map(projectStudioIsometric);
  for (const p of axes)
    expect(Math.hypot(p.x - origin.x, p.y - origin.y)).toBeCloseTo(1, 14);
  expect(axes[0].y).toBe(0.5);
  expect(axes[1].y).toBe(0.5);
  expect(axes[2].y).toBe(-1);
});
it("reproduces every committed SVG from canonical geometry and keeps Mixed as contiguous real regions", () => {
  const output = studioRoofIllustrations();
  expect(Object.keys(output)).toHaveLength(23);
  for (const [name, svg] of Object.entries(output))
    expect(
      fs.readFileSync(path.resolve("apps/portal/public/studio", name), "utf8"),
      name,
    ).toBe(svg);
  const central = studioMixedRoofSwatch(
    "mono",
    "parallel",
    "central",
    "thermopine-150",
  );
  expect(central.match(/data-material="acrylic"/g)).toHaveLength(1);
  expect(central.match(/data-material="solid"/g)).toHaveLength(2);
  expect(central).toContain("40.0000");
  expect(central).toContain("80.0000");
  const house = studioMixedRoofSwatch("gable", "away", "house", "cedar-100");
  expect(house).not.toBe(central);
  expect(house).toContain("#95633f");
  expect(house).toContain("32.0000");
});
