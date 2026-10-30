import { afterEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import * as preview from "../../../../packages/configurator/src/geometry/website/solvePreview";
import { LightingProvider, PreviewBlindProvider, useLighting, usePreviewBlinds } from "@sp/configurator/react/controls";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import { applyStudioHouseEdit } from "@/lib/designStudio/houseEditing";
import { addWebsitePergola } from "@/lib/designStudio/websiteComposition";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import StudioProductContext from "./StudioProductContext";

let mounted: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => { mounted?.unmount(); mounted = undefined; });

it("shares canonical current geometry through the actual House-fallback and nonselected product providers", () => {
  const added = applyStudioHouseEdit(structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT), { kind: "add", id: "house" });
  if (!added.ok) throw Error(added.message);
  const edit = addWebsitePergola(addWebsitePergola({ schemaVersion: "studio_authoring_edit.v1", designId: "shared-geometry-proof", revision: 1,
    spatial: added.spatial, site: {}, objectOptions: [], deletions: [] } as StudioAuthoringEdit, "p1"), "p2");
  const solve = vi.spyOn(preview, "solvePergolaPreview");
  try {
    const resolver = createStudioSceneResolver(), scene = resolver.resolve(edit), first = scene.products[0], calls = solve.mock.calls.length;
    expect(calls).toBe(1); // Both public defaults share the existing resolver's local shape key.
    const captured: Array<{ id: string; sites: unknown; openings: unknown }> = [];
    function Probe({ id }: { id: string }) { captured.push({ id, sites: useLighting()!.sites, openings: usePreviewBlinds()!.openings }); return null; }
    mounted = renderIntoDocument(
      <LightingProvider input={first.design!.input} roof={first.design!.roof} geometryOptions={first.geometryOptions} preparedGeometry={first.geometry ?? null} onChange={() => {}}>
        <PreviewBlindProvider input={first.design!.input} roof={first.design!.roof} geometryOptions={first.geometryOptions} preparedGeometry={first.geometry ?? null} onChange={() => {}}>
          <Probe id="House fallback" />
          {scene.products.map(row => <StudioProductContext key={row.object.id} row={row} active={false} night={false}><Probe id={row.object.id} /></StudioProductContext>)}
        </PreviewBlindProvider>
      </LightingProvider>,
    );
    expect(captured.map(c => c.id)).toEqual(["House fallback", "p1", "p2"]);
    expect(captured[0].sites).toEqual(captured[1].sites);
    expect(captured[0].openings).toEqual(captured[1].openings);
    expect(solve).toHaveBeenCalledTimes(calls);
    expect(resolver.resolve(edit)).toBe(scene);
    expect(solve).toHaveBeenCalledTimes(calls);
  } finally { solve.mockRestore(); }
});
