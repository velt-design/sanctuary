import { expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";
import * as materials from "./studioHouseMaterials";
import * as slabs from "@sp/geometry-viewer/three";
import { houseWorld } from "@/lib/designStudio/studioHouseGeometry";
import { buildWorkbenchProjectModelFromObjectFirstDraft } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import { buildProjectHouseGeometryRegistry } from "@/lib/drawings/state/projectHouseGeometryRegistry";
import StudioHouseNode from "./StudioHouseNode";
vi.mock("@react-three/drei", () => ({ Line: () => null }));

it.each(["hipped", "flat"] as const)(
  "renders exactly the supplied %s roof flashing wings without mutating the canonical model",
  (form) => {
    const geometry = createStudioSceneResolver().resolve(
      studioAttachmentFixture(37, form),
    ).houses[0];
    const before = structuredClone(geometry.model);
    if (form === "hipped") {
      expect(
        geometry.model.roofFlashings?.some(
          (f) => f.metadata?.featureKind === "ridge",
        ),
      ).toBe(true);
      expect(
        geometry.model.roofFlashings?.some(
          (f) => f.metadata?.featureKind === "hip",
        ),
      ).toBe(true);
    } else {
      expect(
        geometry.model.roofFlashings?.some((f) =>
          ["ridge", "hip", "valley"].includes(String(f.metadata?.featureKind)),
        ),
      ).toBe(false);
    }
    const build = vi.spyOn(slabs, "buildPolygonSlabGeometry");
    const mounted = renderIntoDocument(
      <StudioHouseNode
        geometry={geometry}
        selected={false}
        onSelect={() => {}}
        refined
        cad
      />,
    );
    try {
      const expected = (geometry.model.roofFlashings ?? []).flatMap((f) =>
        f.wings.map((w) => [w.boundary, w.plane, f.thicknessMm]),
      );
      expect(build.mock.calls).toEqual(expected);
      expect(geometry.model).toEqual(before);
    } finally {
      mounted.unmount();
      build.mockRestore();
    }
  },
);

it("renders canonically supplied joined-house valleys at the same presentation boundary", () => {
  const edit = studioAttachmentFixture(0, "hipped"),
    form = edit.spatial.houseAssembly!.houseForms[0];
  delete form.position;
  form.transform = { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 };
  const primitive = form.composition.primitives[0];
  if (primitive.kind !== "axisAlignedRectangle")
    throw Error("Expected rectangle fixture");
  form.composition.primitives = [
    { ...primitive, originXMm: 0, originYMm: 0, widthMm: 8000, depthMm: 4000 },
    {
      ...primitive,
      originXMm: 0,
      originYMm: 4000,
      widthMm: 4000,
      depthMm: 4000,
    },
  ];
  form.composition.joins = [
    {
      fromPrimitiveIndex: 0,
      fromEdge: "north",
      toPrimitiveIndex: 1,
      toEdge: "south",
    },
  ];
  const model = buildProjectHouseGeometryRegistry(
    buildWorkbenchProjectModelFromObjectFirstDraft(edit.spatial),
  )[0].model;
  expect(
    model.roofFlashings?.some((f) => f.metadata?.featureKind === "valley"),
  ).toBe(true);
  // Current Studio authoring still retains complex houses as unsupported. This
  // covers the renderer's actual canonical artifact input, not a new editor.
  const geometry = createStudioSceneResolver().resolve(
    studioAttachmentFixture(0, "hipped"),
  ).houses[0];
  const build = vi.spyOn(slabs, "buildPolygonSlabGeometry");
  const mounted = renderIntoDocument(
    <StudioHouseNode
      geometry={{ ...geometry, model }}
      selected={false}
      onSelect={() => {}}
      refined
      cad
    />,
  );
  try {
    expect(build.mock.calls).toEqual(
      (model.roofFlashings ?? []).flatMap((f) =>
        f.wings.map((w) => [w.boundary, w.plane, f.thicknessMm]),
      ),
    );
  } finally {
    mounted.unmount();
    build.mockRestore();
  }
});

it("does not synthesize flashing when the solved artifact supplies none", () => {
  const geometry = createStudioSceneResolver().resolve(
    studioAttachmentFixture(),
  ).houses[0];
  const build = vi.spyOn(slabs, "buildPolygonSlabGeometry");
  const mounted = renderIntoDocument(
    <StudioHouseNode
      geometry={{
        ...geometry,
        model: { ...geometry.model, roofFlashings: [] },
      }}
      selected={false}
      onSelect={() => {}}
      refined
      cad
    />,
  );
  try {
    expect(build).not.toHaveBeenCalled();
  } finally {
    mounted.unmount();
    build.mockRestore();
  }
});

it("transforms flashing slabs once, follows the roof colour and retires their buffers", () => {
  const edit = studioAttachmentFixture(37, "hipped");
  edit.spatial.houseAssembly!.houseForms[0].appearance = {
    roofColour: "#506070",
  };
  const resolver = createStudioSceneResolver(),
    geometry = resolver.resolve(edit).houses[0];
  const local = (geometry.model.roofFlashings ?? []).flatMap((f) =>
    f.wings.map((w) =>
      slabs.buildPolygonSlabGeometry(w.boundary, w.plane, f.thicknessMm),
    ),
  );
  const build = vi.spyOn(slabs, "buildPolygonSlabGeometry");
  const mounted = renderIntoDocument(
    <StudioHouseNode
      geometry={geometry}
      selected={false}
      onSelect={() => {}}
      refined
      cad
    />,
  );
  try {
    expect(build).toHaveBeenCalledTimes(local.length);
    expect(local.length).toBeGreaterThan(0);
    const disposed = build.mock.results.map((r, i) => {
      const result = r.value as ReturnType<
        typeof slabs.buildPolygonSlabGeometry
      >;
      const points = result.getAttribute("position"),
        source = local[i].getAttribute("position");
      expect(points.count).toBe(source.count);
      for (let n = 0; n < points.count; n++) {
        const expected = houseWorld(geometry.house, {
          x: source.getX(n),
          y: source.getY(n),
          z: source.getZ(n),
        });
        expect(points.getX(n)).toBeCloseTo(expected.x, 2);
        expect(points.getY(n)).toBeCloseTo(expected.y, 2);
        expect(points.getZ(n)).toBe(expected.z);
      }
      const dispose = vi.fn();
      result.addEventListener("dispose", dispose);
      return dispose;
    });
    const flashing = mounted.container.querySelector(
      'group[name="house-roof-flashings"]',
    );
    expect(
      flashing?.querySelectorAll('meshstandardmaterial[color="#506070"]')
        .length,
    ).toBe(local.length);
    const changed = structuredClone(edit);
    changed.spatial.houseAssembly!.houseForms[0].appearance!.roofColour =
      "#112233";
    mounted.rerender(
      <StudioHouseNode
        geometry={resolver.resolve(changed).houses[0]}
        selected={false}
        onSelect={() => {}}
        refined
        cad
      />,
    );
    for (const dispose of disposed) expect(dispose).toHaveBeenCalledOnce();
    const remaining = build.mock.results.slice(local.length).map((r) => {
      const dispose = vi.fn();
      r.value.addEventListener("dispose", dispose);
      return dispose;
    });
    expect(
      mounted.container
        .querySelector('group[name="house-roof-flashings"]')
        ?.querySelectorAll('meshstandardmaterial[color="#112233"]').length,
    ).toBe(local.length);
    mounted.unmount();
    for (const dispose of remaining) expect(dispose).toHaveBeenCalledOnce();
  } finally {
    mounted.unmount();
    build.mockRestore();
    local.forEach((g) => g.dispose());
  }
});

/** Real hook/resource lifetime behind DOM custom mesh tags. GPU shaders and the
 * actual house appearance are qualified separately in the native renderer. */
it("retires real house material/texture resources on a changed appearance and unmount", () => {
  const edit = studioAttachmentFixture(),
    resolver = createStudioSceneResolver(),
    geometry = resolver.resolve(edit).houses[0];
  const factory = vi.spyOn(materials, "studioHouseMaterial");
  const mounted = renderIntoDocument(
    <StudioHouseNode
      geometry={geometry}
      selected={false}
      onSelect={() => {}}
      refined
      cad
    />,
  );
  try {
    const original = factory.mock.results.map(
      (result) =>
        result.value as ReturnType<typeof materials.studioHouseMaterial>,
    );
    expect(original.length).toBeGreaterThan(4);
    const retired = original.map((resource) => {
      const dispose = vi.fn(),
        texture = vi.fn();
      resource.material.addEventListener("dispose", dispose);
      resource.texture?.addEventListener("dispose", texture);
      return { resource, dispose, texture };
    });
    const changed = structuredClone(edit);
    changed.spatial.houseAssembly!.houseForms[0].appearance = {
      wallMaterial: "brick",
      roofProfile: "tray",
      roofTrayWidth: 300,
      roofColour: "#506070",
    };
    mounted.rerender(
      <StudioHouseNode
        geometry={resolver.resolve(changed).houses[0]}
        selected={false}
        onSelect={() => {}}
        refined
        cad
      />,
    );
    for (const row of retired) {
      expect(row.dispose).toHaveBeenCalledOnce();
      if (row.resource.texture) expect(row.texture).toHaveBeenCalledOnce();
    }
    const latest = factory.mock.results
      .slice(original.length)
      .map(
        (result) =>
          result.value as ReturnType<typeof materials.studioHouseMaterial>,
      );
    const ended = latest.map((resource) => {
      const dispose = vi.fn(),
        texture = vi.fn();
      resource.material.addEventListener("dispose", dispose);
      resource.texture?.addEventListener("dispose", texture);
      return { resource, dispose, texture };
    });
    mounted.unmount();
    for (const row of ended) {
      expect(row.dispose).toHaveBeenCalledOnce();
      if (row.resource.texture) expect(row.texture).toHaveBeenCalledOnce();
    }
  } finally {
    factory.mockRestore();
  }
});
