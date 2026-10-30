import { act, memo } from "react";
import * as previewGeometry from "../../geometry";
import { DEFAULT_ROOF_FINISH, pergolaLightSites, representativeBlindOpenings } from "@sp/geometry";
import { afterEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import {
  INITIAL_INPUT,
  INITIAL_ROOF,
  type SimpleCoverInput,
  type PreviewRoofChoices,
  type PreviewGeometryOptions,
} from "../../geometry";
import {
  DEFAULT_LIGHTING,
  defaultBlind,
  defaultSidePanel,
  availableRafterSpots,
} from "../../website";
import LightingProvider, { useLighting } from "./LightingProvider";
import PreviewBlindProvider, { usePreviewBlinds } from "./PreviewBlindProvider";

let light: NonNullable<ReturnType<typeof useLighting>>;
let sides: NonNullable<ReturnType<typeof usePreviewBlinds>>;
let renders = 0;
const Probe = memo(function Probe() {
  light = useLighting()!;
  sides = usePreviewBlinds()!;
  renders++;
  return null;
});

it.each(["mono", "box", "gable"] as const)("keeps %s prepared accessories equal to website fallback through a change and Undo", family => {
  const input = { ...INITIAL_INPUT },
    roof: PreviewRoofChoices = { ...INITIAL_ROOF, family,
      ...(family === "box" ? { attachmentIntent: "freestanding", finish: { ...DEFAULT_ROOF_FINISH, material: "combination", ceiling: "thermopine-150" } } : {}),
      ...(family === "gable" ? { orientation: "away", infills: true } : {}),
    },
    geometryOptions = { supportDatumMm: 3100, rearOpenings: family === "box" }, onChange = vi.fn();
  const original = previewGeometry.solvePergolaPreview(input, roof, geometryOptions).geometry!;
  if (family === "box") {
    const openings = representativeBlindOpenings(original.assembly, geometryOptions);
    expect(new Set(openings.map(o => o.side))).toEqual(new Set(["front", "rear", "left", "right"]));
    roof.sidePanels = openings.map(o => defaultSidePanel(o.id, "timber"));
    roof.blinds = [defaultBlind(openings[0].id)];
  }
  const preparedGeometry = previewGeometry.solvePergolaPreview(input, roof, geometryOptions).geometry!;
  mounted = renderIntoDocument(<Tree {...{ input, roof, geometryOptions, onChange }} />);
  const websiteSites = light.sites, websiteOpenings = sides.openings;
  mounted.rerender(<Tree {...{ input, roof, geometryOptions, onChange, preparedGeometry }} />);
  expect(light.sites).toEqual(websiteSites); expect(sides.openings).toEqual(websiteOpenings);
  const nextInput = { ...input, widthMm: 7500 }, nextOptions = { ...geometryOptions, supportDatumMm: 2800 },
    nextGeometry = previewGeometry.solvePergolaPreview(nextInput, roof, nextOptions).geometry!;
  mounted.rerender(<Tree input={nextInput} roof={roof} geometryOptions={nextOptions} preparedGeometry={nextGeometry} onChange={onChange} />);
  const nextSites = pergolaLightSites(nextGeometry.assembly, nextGeometry.covering);
  expect(light.sites).toEqual({ ...nextSites, allRafters: nextSites.rafters, rafters: availableRafterSpots(nextSites.rafters, roof.lighting?.strips ?? []) });
  expect(sides.openings).toEqual(representativeBlindOpenings(nextGeometry.assembly, nextOptions));
  expect(sides.openings).not.toEqual(websiteOpenings);
  mounted.rerender(<Tree {...{ input, roof, geometryOptions, onChange, preparedGeometry }} />);
  expect(light.sites).toEqual(websiteSites); expect(sides.openings).toEqual(websiteOpenings);
  expect(onChange).not.toHaveBeenCalled();
});
function Tree({
  input,
  roof,
  geometryOptions,
  preparedGeometry,
  onChange,
  onChooseSides,
  readOnly = false,
}: {
  input: SimpleCoverInput;
  roof: PreviewRoofChoices;
  geometryOptions?: PreviewGeometryOptions;
  preparedGeometry?: ReturnType<typeof previewGeometry.solvePergolaPreview>["geometry"] | null;
  onChange: (roof: PreviewRoofChoices) => void;
  onChooseSides?: () => void;
  readOnly?: boolean;
}) {
  return (
    <LightingProvider
      input={input}
      roof={roof}
      geometryOptions={geometryOptions}
      {...{ preparedGeometry }}
      onChange={onChange}
    >
      <PreviewBlindProvider
        input={input}
        roof={roof}
        geometryOptions={geometryOptions}
        {...{ preparedGeometry }}
        onChange={onChange}
        onChooseSides={onChooseSides}
        readOnly={readOnly}
      >
        <Probe />
      </PreviewBlindProvider>
    </LightingProvider>
  );
}
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  renders = 0;
});

it("uses the current prepared geometry without solving again and retires unavailable accessories", () => {
  const input = { ...INITIAL_INPUT }, roof = { ...INITIAL_ROOF },
    geometryOptions = { supportDatumMm: 3100 }, onChange = vi.fn(),
    preparedGeometry = previewGeometry.solvePergolaPreview(input, roof, geometryOptions).geometry!;
  const solve = vi.spyOn(previewGeometry, "solvePergolaPreview"),
    openings = vi.spyOn(previewGeometry, "previewBlindOpenings");
  try {
    mounted = renderIntoDocument(<Tree {...{ input, roof, geometryOptions, onChange, preparedGeometry }} />);
    expect(light.sites.rafters.length).toBeGreaterThan(0);
    expect(sides.openings.length).toBeGreaterThan(0);
    expect(solve).not.toHaveBeenCalled();
    expect(openings).not.toHaveBeenCalled();
    mounted.rerender(<Tree {...{ input, roof, geometryOptions, onChange }} preparedGeometry={null} />);
    expect(light.sites).toEqual({ strips: [], rafters: [], cedar: [], allRafters: [] });
    expect(sides.openings).toEqual([]);
    expect(solve).not.toHaveBeenCalled();
    expect(openings).not.toHaveBeenCalled();
    mounted.rerender(<Tree {...{ input, roof, geometryOptions, onChange }} />);
    expect(solve).toHaveBeenCalledTimes(1);
    expect(openings).toHaveBeenCalledTimes(1);
    expect(sides.openings.length).toBeGreaterThan(0);
  } finally { solve.mockRestore(); openings.mockRestore(); }
});

it("does not republish unchanged accessory contexts, but keeps actual presentation state and default autoNight live", () => {
  const props = {
    input: { ...INITIAL_INPUT },
    roof: { ...INITIAL_ROOF },
    geometryOptions: { supportDatumMm: 2400 },
    onChange: vi.fn(),
    onChooseSides: vi.fn(),
  };
  mounted = renderIntoDocument(<Tree {...props} />);
  const firstLight = light,
    firstSides = sides,
    count = renders;
  for (let i = 0; i < 3; i++) mounted.rerender(<Tree {...props} />);
  expect(renders).toBe(count);
  expect(light).toBe(firstLight);
  expect(sides).toBe(firstSides);
  act(() => light.open());
  expect(light.editing).toBe(true);
  expect(light.tool).toBeNull();
  act(() => light.setTool("strip"));
  expect(light.tool).toBe("strip");
  act(() => light.setView("Plan"));
  expect(light.view).toBe("Plan");
  expect(light.night).toBe(false);
  act(() => light.setNight(false));
  act(() => light.setView("3D"));
  expect(light.night).toBe(true);
  act(() => light.close());
  expect(light.editing).toBe(false);
  expect(light.night).toBe(false);
  const opening = sides.openings[0].id;
  act(() => sides.select(opening));
  expect(sides.selected).toBe(opening);
  expect(sides.editing).toBe(true);
  expect(props.onChooseSides).toHaveBeenCalledOnce();
  act(() => sides.setEditing(false));
  expect(sides.selected).toBe("");
  expect(sides.editing).toBe(false);
  expect(props.onChange).not.toHaveBeenCalled();
});

it("uses current roof, fitted geometry and callbacks for real lighting and side edits after input changes", () => {
  const oldChange = vi.fn(),
    nextChange = vi.fn(),
    input = { ...INITIAL_INPUT },
    roof = { ...INITIAL_ROOF };
  mounted = renderIntoDocument(
    <Tree
      input={input}
      roof={roof}
      geometryOptions={{ supportDatumMm: 2400 }}
      onChange={oldChange}
    />,
  );
  const oldSites = light.sites,
    oldOpenings = sides.openings,
    selected = oldOpenings[0].id,
    neighbour = oldOpenings[1].id;
  act(() => sides.select(selected));
  const nextRoof: PreviewRoofChoices = {
    ...roof,
    frameFinish: "white",
    lighting: { ...DEFAULT_LIGHTING, strips: [light.sites.strips[0].id] },
    blinds: [defaultBlind(neighbour)],
    sidePanels: [defaultSidePanel(neighbour, "timber")],
  };
  mounted.rerender(
    <Tree
      input={{ ...input, widthMm: 7500 }}
      roof={nextRoof}
      geometryOptions={{ supportDatumMm: 3100 }}
      onChange={nextChange}
    />,
  );
  expect(light.roof).toBe(nextRoof);
  expect(light.value).toBe(nextRoof.lighting);
  expect(light.sites).not.toEqual(oldSites);
  expect(sides.openings).not.toEqual(oldOpenings);
  expect(sides.blinds).toBe(nextRoof.blinds);
  expect(sides.panels).toBe(nextRoof.sidePanels);
  const strip = light.sites.strips.find(
    (site) => !nextRoof.lighting!.strips.includes(site.id),
  )!.id;
  act(() => light.toggle(strip));
  expect(nextChange).toHaveBeenLastCalledWith({
    ...nextRoof,
    lighting: {
      ...nextRoof.lighting,
      strips: [...nextRoof.lighting!.strips, strip],
    },
  });
  const panel = defaultSidePanel(selected, "aluminium");
  act(() => sides.setPanel(panel));
  expect(nextChange).toHaveBeenLastCalledWith({
    ...nextRoof,
    sidePanels: [...nextRoof.sidePanels!, panel],
  });
  act(() => sides.setKind("blind"));
  expect(nextChange).toHaveBeenLastCalledWith({
    ...nextRoof,
    blinds: [...nextRoof.blinds!, defaultBlind(selected)],
  });
  act(() => sides.update([]));
  expect(nextChange).toHaveBeenLastCalledWith({ ...nextRoof, blinds: [] });
  expect(oldChange).not.toHaveBeenCalled();
});

it("updates read-only selection and current choose callbacks without passive changes or losing the existing opening", () => {
  const first = vi.fn(),
    next = vi.fn(),
    change = vi.fn(),
    props = { input: INITIAL_INPUT, roof: INITIAL_ROOF, onChange: change };
  mounted = renderIntoDocument(
    <Tree {...props} readOnly onChooseSides={first} />,
  );
  const opening = sides.openings[0].id;
  act(() => sides.select(opening));
  expect(sides.editing).toBe(false);
  expect(first).not.toHaveBeenCalled();
  mounted.rerender(<Tree {...props} onChooseSides={next} />);
  act(() => sides.select(opening));
  expect(sides.selected).toBe(opening);
  expect(next).toHaveBeenCalledOnce();
  expect(first).not.toHaveBeenCalled();
  mounted.rerender(<Tree {...props} readOnly onChooseSides={first} />);
  act(() => sides.select(sides.openings[1].id));
  expect(sides.selected).toBe(opening);
  expect(first).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
});
